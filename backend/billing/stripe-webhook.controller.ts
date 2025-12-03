import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
} from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { Request } from "express";

@Controller("billing")
export class StripeWebhookController {
  constructor(private readonly stripeService: StripeService) {}

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string
  ) {
    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error("Missing raw body");
    }

    await this.stripeService.handleWebhook(rawBody, signature);

    return { received: true };
  }
}
