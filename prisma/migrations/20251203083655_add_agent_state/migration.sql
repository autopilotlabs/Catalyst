-- CreateTable
CREATE TABLE "AgentState" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentState_runId_key" ON "AgentState"("runId");

-- AddForeignKey
ALTER TABLE "AgentState" ADD CONSTRAINT "AgentState_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
