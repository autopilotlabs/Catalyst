import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RateLimitService } from "../rate-limit/rate-limit.service";
import {
  RATE_LIMIT_KEY,
  RateLimitMetadata,
} from "../rate-limit/rate-limit.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit metadata from decorator
    const rateLimitMetadata = this.reflector.get<RateLimitMetadata>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    // If no rate limit metadata, allow access
    if (!rateLimitMetadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext: AuthContextData = request.authContext;

    // If no auth context, skip rate limiting (other guards will handle auth)
    if (!authContext || !authContext.workspaceId) {
      this.logger.warn("No auth context found for rate limiting");
      return true;
    }

    const { key, limit } = rateLimitMetadata;

    // Check and increment rate limit
    await this.rateLimitService.checkAndIncrement(authContext, key, limit);

    return true;
  }
}
