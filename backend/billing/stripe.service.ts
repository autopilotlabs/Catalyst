import { Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthContextData } from "../context/auth-context.interface";

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: "2025-11-17.clover",
    });

    this.logger.log("Stripe service initialized");
  }

  async createCustomer(workspace: any): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        name: workspace.name,
        metadata: {
          workspaceId: workspace.id,
        },
      });

      this.logger.log(`Created Stripe customer: ${customer.id} for workspace: ${workspace.id}`);
      return customer.id;
    } catch (error: any) {
      this.logger.error(`Failed to create Stripe customer: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createCheckoutSession(
    ctx: AuthContextData,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    try {
      // Get or create subscription record
      let subscription = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId: ctx.workspaceId },
        include: { workspace: true },
      });

      if (!subscription) {
        // Create subscription record
        subscription = await this.prisma.workspaceSubscription.create({
          data: {
            workspaceId: ctx.workspaceId,
            status: "inactive",
          },
          include: { workspace: true },
        });
      }

      // Get or create Stripe customer
      let customerId = subscription.stripeCustomerId;
      if (!customerId) {
        customerId = await this.createCustomer(subscription.workspace);
        await this.prisma.workspaceSubscription.update({
          where: { id: subscription.id },
          data: { stripeCustomerId: customerId },
        });
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          workspaceId: ctx.workspaceId,
        },
      });

      // Audit log
      await this.auditService.record(ctx, {
        action: "billing.checkout.created",
        entityType: "workspace",
        entityId: ctx.workspaceId,
        metadata: {
          priceId,
          sessionId: session.id,
        },
      });

      this.logger.log(`Created checkout session: ${session.id} for workspace: ${ctx.workspaceId}`);
      return session.url!;
    } catch (error: any) {
      this.logger.error(`Failed to create checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createPortalSession(ctx: AuthContextData, returnUrl: string): Promise<string> {
    try {
      const subscription = await this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId: ctx.workspaceId },
      });

      if (!subscription?.stripeCustomerId) {
        throw new Error("No Stripe customer found for this workspace");
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      });

      // Audit log
      await this.auditService.record(ctx, {
        action: "billing.portal.accessed",
        entityType: "workspace",
        entityId: ctx.workspaceId,
        metadata: {
          sessionId: session.id,
        },
      });

      this.logger.log(`Created portal session for workspace: ${ctx.workspaceId}`);
      return session.url;
    } catch (error: any) {
      this.logger.error(`Failed to create portal session: ${error.message}`, error.stack);
      throw error;
    }
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      this.logger.log(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case "invoice.paid":
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.debug(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspaceId;
    if (!workspaceId) {
      this.logger.warn(`Subscription ${subscription.id} has no workspaceId in metadata`);
      return;
    }

    const subAny = subscription as any;
    const periodStart = subAny.current_period_start 
      ? new Date(subAny.current_period_start * 1000)
      : new Date();
    const periodEnd = subAny.current_period_end
      ? new Date(subAny.current_period_end * 1000)
      : new Date();

    await this.prisma.workspaceSubscription.upsert({
      where: { workspaceId },
      update: {
        stripeSubId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        status: subscription.status,
        periodStart,
        periodEnd,
      },
      create: {
        workspaceId,
        stripeCustomerId: subscription.customer as string,
        stripeSubId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        status: subscription.status,
        periodStart,
        periodEnd,
      },
    });

    // Audit log (system context)
    await this.auditService.record(
      { userId: "system", workspaceId, role: "system" } as AuthContextData,
      {
        action: "billing.subscription.updated",
        entityType: "workspace",
        entityId: workspaceId,
        metadata: {
          subscriptionId: subscription.id,
          status: subscription.status,
          periodStart,
          periodEnd,
        },
      }
    );

    this.logger.log(`Updated subscription for workspace: ${workspaceId}, status: ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const workspaceId = subscription.metadata?.workspaceId;
    if (!workspaceId) {
      this.logger.warn(`Subscription ${subscription.id} has no workspaceId in metadata`);
      return;
    }

    await this.prisma.workspaceSubscription.update({
      where: { workspaceId },
      data: {
        status: "inactive",
      },
    });

    // Audit log (system context)
    await this.auditService.record(
      { userId: "system", workspaceId, role: "system" } as AuthContextData,
      {
        action: "billing.subscription.deleted",
        entityType: "workspace",
        entityId: workspaceId,
        metadata: {
          subscriptionId: subscription.id,
        },
      }
    );

    this.logger.log(`Deleted subscription for workspace: ${workspaceId}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(
      subscriptionId as string
    );

    await this.handleSubscriptionUpdate(subscription);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const subscription = await this.prisma.workspaceSubscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (subscription) {
      // Audit log (system context)
      await this.auditService.record(
        { userId: "system", workspaceId: subscription.workspaceId, role: "system" } as AuthContextData,
        {
          action: "billing.payment.failed",
          entityType: "workspace",
          entityId: subscription.workspaceId,
          metadata: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due,
          },
        }
      );

      this.logger.warn(`Payment failed for workspace: ${subscription.workspaceId}, invoice: ${invoice.id}`);
    }
  }

  async getSubscriptionStatus(workspaceId: string): Promise<any> {
    const subscription = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      return {
        status: "inactive",
        hasActiveSubscription: false,
      };
    }

    const hasActiveSubscription = ["active", "trialing"].includes(subscription.status);

    return {
      status: subscription.status,
      hasActiveSubscription,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }
}
