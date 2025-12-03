import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { UserSettingsService } from "./user-settings.service";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextGuard } from "../context/auth-context.guard";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("user")
@UseGuards(AuthContextGuard)
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  // ========== USER SETTINGS ==========

  @Get("settings")
  async getSettings(@AuthContext() ctx: AuthContextData) {
    const settings = await this.userSettingsService.getSettings(ctx.userId);
    return { data: settings };
  }

  @Patch("settings")
  async updateSettings(
    @AuthContext() ctx: AuthContextData,
    @Body() body: any
  ) {
    const updated = await this.userSettingsService.updateSettings(
      ctx.userId,
      body,
      ctx
    );
    return { data: updated };
  }

  // ========== API KEYS ==========

  @Get("api-keys")
  async getApiKeys(@AuthContext() ctx: AuthContextData) {
    const apiKeys = await this.userSettingsService.getApiKeys(ctx.userId);
    return { data: apiKeys };
  }

  @Post("api-keys")
  async createApiKey(@AuthContext() ctx: AuthContextData, @Body() body: any) {
    const result = await this.userSettingsService.createApiKey(
      ctx.userId,
      body,
      ctx
    );
    return { data: result };
  }

  @Delete("api-keys/:id")
  async revokeApiKey(
    @AuthContext() ctx: AuthContextData,
    @Param("id") keyId: string
  ) {
    const result = await this.userSettingsService.revokeApiKey(
      ctx.userId,
      keyId,
      ctx
    );
    return { data: result };
  }
}
