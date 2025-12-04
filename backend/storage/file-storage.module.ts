import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { FileStorageService } from "./file-storage.service";
import { FileStorageController } from "./file-storage.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { ObservabilityModule } from "../observability/observability.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ObservabilityModule,
    BillingModule,
    MulterModule.register({
      storage: undefined, // Use memory storage (file.buffer)
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || "104857600"), // 100MB default
      },
    }),
  ],
  providers: [FileStorageService],
  controllers: [FileStorageController],
  exports: [FileStorageService],
})
export class FileStorageModule {}
