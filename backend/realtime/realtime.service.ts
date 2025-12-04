import { Injectable, Logger } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  /**
   * Broadcast an event to all clients in a workspace
   */
  broadcast(workspaceId: string, event: string, data: any) {
    try {
      this.gateway.broadcastToWorkspace(workspaceId, event, data);
      this.logger.debug(
        `Broadcast event: workspace=${workspaceId}, event=${event}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to broadcast event: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Broadcast an event to a specific user
   */
  broadcastToUser(userId: string, event: string, data: any) {
    try {
      this.gateway.broadcastToUser(userId, event, data);
      this.logger.debug(`Broadcast event: user=${userId}, event=${event}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to broadcast to user: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get active client count for a workspace
   */
  getWorkspaceClientCount(workspaceId: string): number {
    return this.gateway.getWorkspaceClientCount(workspaceId);
  }

  /**
   * Get active client count for a user
   */
  getUserClientCount(userId: string): number {
    return this.gateway.getUserClientCount(userId);
  }
}
