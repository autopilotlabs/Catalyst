"use client";

import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

let socket: Socket | null = null;

export interface RealtimeEvent {
  event: string;
  data: any;
  timestamp: string;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

/**
 * Get or create the realtime WebSocket client
 */
export function getRealtimeClient(
  workspaceId: string,
  userId: string,
  role: string = "member"
): Socket {
  if (!socket) {
    socket = io(`${BACKEND_URL}/realtime`, {
      extraHeaders: {
        "x-user-id": userId,
        "x-workspace-id": workspaceId,
        "x-role": role,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[Realtime] Connected to WebSocket server");
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Realtime] Disconnected: ${reason}`);
    });

    socket.on("connect_error", (error) => {
      console.error("[Realtime] Connection error:", error);
    });

    socket.on("connected", (data) => {
      console.log("[Realtime] Connection confirmed:", data);
    });
  }

  return socket;
}

/**
 * Subscribe to a specific event
 */
export function subscribeToEvent(
  eventName: string,
  handler: (data: any) => void
): () => void {
  if (!socket) {
    console.warn("[Realtime] Socket not initialized. Call getRealtimeClient first.");
    return () => {};
  }

  socket.on(eventName, handler);

  // Return unsubscribe function
  return () => {
    if (socket) {
      socket.off(eventName, handler);
    }
  };
}

/**
 * Disconnect the WebSocket client
 */
export function disconnectRealtimeClient() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if the client is connected
 */
export function isConnected(): boolean {
  return socket ? socket.connected : false;
}

/**
 * Get the socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}
