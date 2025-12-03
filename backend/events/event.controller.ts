import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { EventBusService } from "./event-bus.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("events")
export class EventController {
  constructor(private readonly bus: EventBusService) {}

  @UseGuards(AuthContextGuard)
  @Post("emit")
  async emit(@AuthContext() ctx: AuthContextData, @Body() body: any) {
    // Validate required fields
    if (!body.type) {
      throw new Error("Event type is required");
    }

    // Emit event to the bus with workspace context
    await this.bus.emit({
      workspaceId: ctx.workspaceId,
      type: body.type,
      data: body.data || {},
    });

    return { success: true };
  }
}
