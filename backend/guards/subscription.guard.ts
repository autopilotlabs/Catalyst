import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.headers["x-workspace-id"];

    if (!workspaceId) {
      throw new HttpException(
        "Workspace ID is required",
        HttpStatus.UNAUTHORIZED
      );
    }

    // Check subscription status
    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });

    // Allow if no subscription exists (for backwards compatibility during migration)
    // Or if subscription is active or trialing
    if (!subscription) {
      return true; // Allow access if no subscription record yet
    }

    const hasActiveSubscription = ["active", "trialing"].includes(
      subscription.status
    );

    if (!hasActiveSubscription) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message:
            "This workspace requires an active subscription. Please upgrade your plan.",
          error: "Payment Required",
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    return true;
  }
}
