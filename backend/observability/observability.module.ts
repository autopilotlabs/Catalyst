import { Module } from "@nestjs/common";
import { ObservabilityService } from "./observability.service";
import { ObservabilityController } from "./observability.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ObservabilityService],
  controllers: [ObservabilityController],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
