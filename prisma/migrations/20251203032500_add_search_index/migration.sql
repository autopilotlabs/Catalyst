-- CreateTable
CREATE TABLE "SearchIndex" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" BYTEA,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchIndex_workspaceId_entityType_idx" ON "SearchIndex"("workspaceId", "entityType");

-- CreateIndex
CREATE INDEX "SearchIndex_workspaceId_entityId_idx" ON "SearchIndex"("workspaceId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndex_workspaceId_entityType_entityId_key" ON "SearchIndex"("workspaceId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
