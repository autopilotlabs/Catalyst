import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthContextData } from "../context/auth-context.interface";

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate an invoice for a billing cycle
   */
  async generateInvoiceForCycle(workspaceId: string, billingCycleId: string) {
    // Fetch billing cycle with usage entries
    const cycle = await this.prisma.billingCycle.findFirst({
      where: {
        id: billingCycleId,
        workspaceId,
      },
      include: {
        usageEntries: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException("Billing cycle not found");
    }

    // Check if invoice already exists
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        workspaceId,
        billingCycleId,
      },
    });

    if (existingInvoice) {
      this.logger.log(
        `Invoice already exists for cycle ${billingCycleId}: ${existingInvoice.id}`
      );
      return existingInvoice;
    }

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        workspaceId,
        billingCycleId,
        amount: cycle.totalCost,
      },
    });

    this.logger.log(
      `Generated invoice ${invoice.id} for cycle ${billingCycleId} (amount: $${cycle.totalCost.toFixed(2)})`
    );

    return invoice;
  }

  /**
   * Attach PDF URL to an invoice
   */
  async attachPdf(invoiceId: string, pdfUrl: string) {
    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl },
    });

    this.logger.log(`Attached PDF to invoice ${invoiceId}: ${pdfUrl}`);
    return invoice;
  }

  /**
   * Get all invoices for a workspace
   */
  async getInvoices(ctx: AuthContextData) {
    return this.prisma.invoice.findMany({
      where: {
        workspaceId: ctx.workspaceId,
      },
      include: {
        billingCycle: {
          select: {
            periodStart: true,
            periodEnd: true,
            totalCost: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Get a specific invoice
   */
  async getInvoice(ctx: AuthContextData, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        workspaceId: ctx.workspaceId,
      },
      include: {
        billingCycle: {
          include: {
            usageEntries: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    return invoice;
  }

  /**
   * Get invoice for the current active cycle (if exists)
   */
  async getActiveCycleInvoice(ctx: AuthContextData) {
    // Find active cycle
    const activeCycle = await this.prisma.billingCycle.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        closed: false,
      },
      orderBy: {
        periodStart: "desc",
      },
    });

    if (!activeCycle) {
      return null;
    }

    // Find invoice for active cycle
    return this.prisma.invoice.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        billingCycleId: activeCycle.id,
      },
    });
  }
}
