import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { AuthContextGuard } from "../context/auth-context.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";

@Controller("billing")
@UseGuards(AuthContextGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly stripeService: StripeService) {}

  @Post("checkout")
  @RequirePermission("workspace.billing")
  async createCheckout(
    @AuthContext() ctx: AuthContextData,
    @Body("priceId") priceId: string,
    @Body("successUrl") successUrl?: string,
    @Body("cancelUrl") cancelUrl?: string
  ) {
    if (!priceId) {
      throw new Error("priceId is required");
    }

    const defaultSuccessUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing?success=true`;
    const defaultCancelUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing?canceled=true`;

    const url = await this.stripeService.createCheckoutSession(
      ctx,
      priceId,
      successUrl || defaultSuccessUrl,
      cancelUrl || defaultCancelUrl
    );

    return { url };
  }

  @Post("portal")
  @RequirePermission("workspace.billing")
  async createPortal(
    @AuthContext() ctx: AuthContextData,
    @Body("returnUrl") returnUrl?: string
  ) {
    const defaultReturnUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing`;

    const url = await this.stripeService.createPortalSession(
      ctx,
      returnUrl || defaultReturnUrl
    );

    return { url };
  }

  @Get("status")
  @RequirePermission("workspace.billing")
  async getStatus(@AuthContext() ctx: AuthContextData) {
    const status = await this.stripeService.getSubscriptionStatus(ctx.workspaceId);
    return status;
  }
}
