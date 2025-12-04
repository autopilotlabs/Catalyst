import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { ApiKeyService } from "../api-keys/api-key.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for API key in header
    const apiKey = request.headers["x-api-key"];

    // If no API key, let other guards handle authentication
    if (!apiKey) {
      return true;
    }

    // Validate API key
    const authContext = await this.apiKeyService.validateApiKey(apiKey);

    if (!authContext) {
      this.logger.warn(`Invalid API key attempt`);
      throw new UnauthorizedException("Invalid or expired API key");
    }

    // Attach auth context to request
    request.authContext = authContext;

    this.logger.debug(
      `API key authenticated for workspace ${authContext.workspaceId} with role ${authContext.membership.role}`
    );

    return true;
  }
}
