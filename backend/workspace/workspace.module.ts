import { Module } from "@nestjs/common";
import { MembersController } from "./members.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MembersController],
})
export class WorkspaceModule {}
