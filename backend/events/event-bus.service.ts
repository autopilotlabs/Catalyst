import { Injectable, Logger } from "@nestjs/common";

export interface EventPayload {
  workspaceId: string;
  type: string;
  data: any;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private listeners: Array<(event: EventPayload) => Promise<void>> = [];

  registerListener(fn: (event: EventPayload) => Promise<void>) {
    this.listeners.push(fn);
    this.logger.log(`Registered event listener. Total listeners: ${this.listeners.length}`);
  }

  async emit(event: EventPayload) {
    this.logger.log(`Emitting event: ${event.type} for workspace: ${event.workspaceId}`);
    
    for (const fn of this.listeners) {
      try {
        await fn(event);
      } catch (error: any) {
        this.logger.error(
          `Error in event listener for ${event.type}: ${error.message}`,
          error.stack
        );
      }
    }
    
    this.logger.log(`Event ${event.type} processed by ${this.listeners.length} listeners`);
  }
}
