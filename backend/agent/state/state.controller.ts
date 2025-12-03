import { Controller, Get, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { AgentStateService } from "./state.service";
import { AuthContext } from "../../context/auth-context.decorator";
import { AuthContextGuard } from "../../context/auth-context.guard";
import { AuthContextData } from "../../context/auth-context.interface";

@Controller("agent/state")
@UseGuards(AuthContextGuard)
export class StateController {
  constructor(private readonly service: AgentStateService) {}

  @Get(":runId")
  async getState(
    @Param("runId") runId: string,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.service.get(runId);
  }

  @Patch(":runId")
  async updateState(
    @Param("runId") runId: string,
    @Body() patch: any,
    @AuthContext() ctx: AuthContextData
  ) {
    return this.service.update(runId, patch);
  }
}
