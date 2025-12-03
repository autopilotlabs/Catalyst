-- CreateTable
CREATE TABLE "EventTrigger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL,
    "filter" JSONB,
    "agentId" TEXT NOT NULL,
    "inputTemplate" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventTrigger_workspaceId_idx" ON "EventTrigger"("workspaceId");

-- CreateIndex
CREATE INDEX "EventTrigger_eventType_idx" ON "EventTrigger"("eventType");

-- CreateIndex
CREATE INDEX "EventTrigger_enabled_idx" ON "EventTrigger"("enabled");

-- AddForeignKey
ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTrigger" ADD CONSTRAINT "EventTrigger_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
