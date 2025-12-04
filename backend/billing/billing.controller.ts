import { Controller, Get, Param, UseGuards, Res, StreamableFile } from "@nestjs/common";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { AuthContextGuard } from "../context/auth-context.guard";
import { SubscriptionGuard } from "../guards/subscription.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { AuthContext } from "../context/auth-context.decorator";
import { AuthContextData } from "../context/auth-context.interface";
import { BillingService } from "./billing.service";
import { InvoiceService } from "./invoice.service";

@Controller("billing")
@UseGuards(AuthContextGuard, SubscriptionGuard, PermissionsGuard, RateLimitGuard)
@RequirePermission("workspace.billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly invoiceService: InvoiceService
  ) {}

  @Get("cycles")
  @RateLimit("billing.cycles", 60)
  async listCycles(@AuthContext() ctx: AuthContextData) {
    const cycles = await this.billingService.listCycles(ctx);
    return { data: cycles };
  }

  @Get("cycles/:cycleId")
  @RateLimit("billing.cycle", 60)
  async getCycle(
    @AuthContext() ctx: AuthContextData,
    @Param("cycleId") cycleId: string
  ) {
    const cycle = await this.billingService.getCycle(ctx, cycleId);
    return { data: cycle };
  }

  @Get("usage")
  @RateLimit("billing.usage", 60)
  async getCurrentUsage(@AuthContext() ctx: AuthContextData) {
    const usage = await this.billingService.getCurrentUsage(ctx);
    return { data: usage };
  }

  @Get("invoices")
  @RateLimit("billing.invoices", 60)
  async listInvoices(@AuthContext() ctx: AuthContextData) {
    const invoices = await this.invoiceService.getInvoices(ctx);
    return { data: invoices };
  }

  @Get("invoices/:invoiceId")
  @RateLimit("billing.invoice", 60)
  async getInvoice(
    @AuthContext() ctx: AuthContextData,
    @Param("invoiceId") invoiceId: string
  ) {
    const invoice = await this.invoiceService.getInvoice(ctx, invoiceId);
    return { data: invoice };
  }

  @Get("invoices/:invoiceId/pdf")
  @RateLimit("billing.invoice.pdf", 60)
  async getInvoicePdf(
    @AuthContext() ctx: AuthContextData,
    @Param("invoiceId") invoiceId: string,
    @Res() res: Response
  ) {
    const invoice = await this.invoiceService.getInvoice(ctx, invoiceId);

    if (!invoice.pdfUrl) {
      return res.status(404).json({ error: "PDF not available" });
    }

    // For now, return a simple text response
    // In production, stream actual PDF file from disk/S3
    const pdfPath = path.join(__dirname, "../invoices", invoice.pdfUrl);

    // Check if file exists
    if (fs.existsSync(pdfPath)) {
      const file = fs.readFileSync(pdfPath);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoice.pdfUrl}"`
      );
      return res.send(file);
    } else {
      // Return placeholder
      res.setHeader("Content-Type", "text/plain");
      return res.send(
        `Invoice PDF for ${invoice.id}\nAmount: $${invoice.amount}\nGenerated: ${invoice.createdAt}`
      );
    }
  }
}
