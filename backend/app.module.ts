import { Module, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthContextData } from './context/auth-context.interface';
import { PrismaModule } from './prisma/prisma.module';
import { ProtectedModule } from './protected/protected.module';
import { AgentModule } from './agent/agent.module';
import { OpenAIModule } from './openai/openai.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EventsModule } from './events/events.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { BillingModule } from './billing/billing.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { SearchModule } from './search/search.module';
import { UserModule } from './user/user.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { ApiKeyModule } from './api-keys/api-key.module';
import { ExternalApiModule } from './external/external-api.module';
import { JobModule } from './jobs/job.module';
import { ModelsModule } from './models/models.module';
import { EvalModule } from './evals/eval.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { WorkspaceLimitModule } from './limits/workspace-limit.module';
import { ExportModule } from './exports/export.module';
import { ImportModule } from './imports/import.module';
import { WorkspaceCloneModule } from './workspaces/workspace-clone.module';
import { ObservabilityModule } from './observability/observability.module';
import { EnvModule } from './env/env.module';
import { AgentVersionModule } from './agent/version/agent-version.module';
import { AgentDeploymentModule } from './agent/deployment/agent-deployment.module';
import { ModelVersionModule } from './models/version/model-version.module';
import { ModelDeploymentModule } from './models/deployment/model-deployment.module';
import { FileStorageModule } from './storage/file-storage.module';
import { EventBusService } from './events/event-bus.service';
import { EventTriggerService } from './events/event-trigger.service';
import { JobQueueService } from './jobs/job-queue.service';
import { AgentExecutionService } from './agent/agent-execution.service';
import { WorkflowExecutionService } from './workflows/workflow-execution.service';
import { SearchIndexService } from './search/search-index.service';
import { MemoryService } from './agent/memory/memory.service';
import { NotificationsService } from './notifications/notifications.service';
import { EvalService } from './evals/eval.service';
import { InvoiceService } from './billing/invoice.service';
import { AuditService } from './audit/audit.service';
import { ExportService } from './exports/export.service';
import { ImportService } from './imports/import.service';
import { WorkspaceCloneService } from './workspaces/workspace-clone.service';

@Module({
  imports: [
    PrismaModule,
    OpenAIModule,
    ProtectedModule,
    AgentModule,
    SchedulerModule,
    EventsModule,
    WorkflowsModule,
    AnalyticsModule,
    AuditModule,
    BillingModule,
    WorkspaceModule,
    SearchModule,
    UserModule,
    NotificationsModule,
    RealtimeModule,
    RateLimitModule,
    ApiKeyModule,
    ExternalApiModule,
    JobModule,
    ModelsModule,
    EvalModule,
    MaintenanceModule,
    WorkspaceLimitModule,
    ExportModule,
    ImportModule,
    WorkspaceCloneModule,
    ObservabilityModule,
    EnvModule,
    AgentVersionModule,
    AgentDeploymentModule,
    ModelVersionModule,
    ModelDeploymentModule,
    FileStorageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly eventTriggerService: EventTriggerService,
    private readonly jobQueue: JobQueueService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly searchIndexService: SearchIndexService,
    private readonly memoryService: MemoryService,
    private readonly notificationsService: NotificationsService,
    private readonly evalService: EvalService,
    private readonly invoiceService: InvoiceService,
    private readonly auditService: AuditService,
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly workspaceCloneService: WorkspaceCloneService
  ) {
    // Register event trigger service as a listener to the event bus
    this.eventBus.registerListener((event) =>
      this.eventTriggerService.handleIncomingEvent(event)
    );

    // Register job handlers
    this.registerJobHandlers();
  }

  private registerJobHandlers() {
    // Agent execution
    this.jobQueue.registerHandler(
      'agent.run',
      this.agentExecutionService.runJob.bind(this.agentExecutionService)
    );

    // Workflow execution
    this.jobQueue.registerHandler(
      'workflow.run',
      this.workflowExecutionService.runJob.bind(this.workflowExecutionService)
    );

    // Event trigger execution
    this.jobQueue.registerHandler(
      'event.trigger.run',
      this.eventTriggerService.runJob.bind(this.eventTriggerService)
    );

    // Search indexing
    this.jobQueue.registerHandler(
      'search.index',
      this.searchIndexService.runJob.bind(this.searchIndexService)
    );

    // Memory embedding
    this.jobQueue.registerHandler(
      'memory.embed',
      this.memoryService.runEmbeddingJob.bind(this.memoryService)
    );

    // Webhook delivery
    this.jobQueue.registerHandler(
      'webhook.deliver',
      this.notificationsService.runWebhookJob.bind(this.notificationsService)
    );

    // Eval run
    this.jobQueue.registerHandler(
      'eval.run',
      this.evalService.processEvalRun.bind(this.evalService)
    );

    this.jobQueue.registerHandler(
      'billing.closeCycle.generateInvoice',
      this.processInvoiceGeneration.bind(this)
    );

    // Export generation
    this.jobQueue.registerHandler(
      'export.generate',
      this.processExportGeneration.bind(this)
    );

    // Import execution
    this.jobQueue.registerHandler(
      'import.execute',
      this.processImportExecution.bind(this)
    );

    // Workspace clone
    this.jobQueue.registerHandler(
      'workspace.clone',
      this.processWorkspaceClone.bind(this)
    );
  }

  private async processInvoiceGeneration(payload: {
    workspaceId: string;
    cycleId: string;
    userId: string;
    role: string;
  }) {
    const ctx: AuthContextData = {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      membership: {
        role: payload.role as 'owner' | 'admin' | 'member' | 'viewer',
      },
    };

    try {
      // Generate invoice
      const invoice = await this.invoiceService.generateInvoiceForCycle(
        payload.workspaceId,
        payload.cycleId
      );

      // Generate PDF (simple HTML-based)
      const pdfContent = this.generateInvoicePdf(invoice);
      
      // For now, store PDF URL as data URI (in production, save to file/S3)
      const pdfUrl = `invoice-${invoice.id}.pdf`;
      
      // Attach PDF URL to invoice
      await this.invoiceService.attachPdf(invoice.id, pdfUrl);

      // Send notification
      await this.notificationsService.sendToWorkspace(
        payload.workspaceId,
        "billing.invoice.generated",
        "Invoice Generated",
        `Your invoice for $${invoice.amount.toFixed(2)} is ready.`,
        {
          invoiceId: invoice.id,
          amount: invoice.amount,
        }
      );

      // Audit log
      await this.auditService.record(ctx, {
        action: "invoice.generated",
        entityType: "Invoice",
        entityId: invoice.id,
        metadata: {
          cycleId: payload.cycleId,
          amount: invoice.amount,
        },
      });

      this.logger.log(
        `Successfully generated invoice ${invoice.id} for cycle ${payload.cycleId}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to generate invoice for cycle ${payload.cycleId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private generateInvoicePdf(invoice: any): string {
    // Simple PDF generation placeholder
    // In production, use pdf-lib or jspdf to generate actual PDFs
    return `Invoice ${invoice.id} - Amount: $${invoice.amount}`;
  }

  private async processExportGeneration(payload: { exportId: string }) {
    try {
      await this.exportService.runExportJob(payload.exportId);
      this.logger.log(
        `Successfully generated export ${payload.exportId}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to generate export ${payload.exportId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async processImportExecution(payload: { importId: string }) {
    try {
      await this.importService.executeImportJob(payload.importId);
      this.logger.log(
        `Successfully executed import ${payload.importId}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute import ${payload.importId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async processWorkspaceClone(payload: { cloneId: string }) {
    try {
      await this.workspaceCloneService.executeCloneJob(payload.cloneId);
      this.logger.log(
        `Successfully executed workspace clone ${payload.cloneId}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute workspace clone ${payload.cloneId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
}

