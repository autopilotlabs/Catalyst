import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*", // Allow all origins for local development
    credentials: true,
  },
  namespace: "/realtime",
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  afterInit(server: Server) {
    this.logger.log("WebSocket Gateway initialized");
  }

  handleConnection(client: Socket) {
    try {
      // Extract auth headers from handshake
      const userId = client.handshake.headers["x-user-id"] as string;
      const workspaceId = client.handshake.headers["x-workspace-id"] as string;
      const role = client.handshake.headers["x-role"] as string;

      // Validate required headers
      if (!userId || !workspaceId) {
        this.logger.warn(
          `Client ${client.id} rejected: missing auth headers`
        );
        client.disconnect();
        return;
      }

      // Store user metadata on socket
      client.data.userId = userId;
      client.data.workspaceId = workspaceId;
      client.data.role = role || "member";

      // Join workspace room
      const roomName = `workspace:${workspaceId}`;
      client.join(roomName);

      // Join user-specific room
      const userRoomName = `user:${userId}`;
      client.join(userRoomName);

      this.logger.log(
        `Client ${client.id} connected: user=${userId}, workspace=${workspaceId}, rooms=[${roomName}, ${userRoomName}]`
      );

      // Send connection confirmation
      client.emit("connected", {
        userId,
        workspaceId,
        role: client.data.role,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(
        `Error handling connection: ${error.message}`,
        error.stack
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const workspaceId = client.data.workspaceId;

    this.logger.log(
      `Client ${client.id} disconnected: user=${userId}, workspace=${workspaceId}`
    );
  }

  /**
   * Broadcast to all clients in a workspace
   */
  broadcastToWorkspace(workspaceId: string, event: string, payload: any) {
    const roomName = `workspace:${workspaceId}`;
    this.server.to(roomName).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(
      `Broadcast to ${roomName}: event=${event}, payload=${JSON.stringify(payload).substring(0, 100)}`
    );
  }

  /**
   * Broadcast to a specific user across all their connections
   */
  broadcastToUser(userId: string, event: string, payload: any) {
    const roomName = `user:${userId}`;
    this.server.to(roomName).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(
      `Broadcast to ${roomName}: event=${event}, payload=${JSON.stringify(payload).substring(0, 100)}`
    );
  }

  /**
   * Get count of connected clients in a workspace
   */
  getWorkspaceClientCount(workspaceId: string): number {
    const roomName = `workspace:${workspaceId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Get count of connected clients for a user
   */
  getUserClientCount(userId: string): number {
    const roomName = `user:${userId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }
}
