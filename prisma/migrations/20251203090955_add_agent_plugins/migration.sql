-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PluginTool" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginTool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plugin_workspaceId_idx" ON "Plugin"("workspaceId");

-- CreateIndex
CREATE INDEX "Plugin_enabled_idx" ON "Plugin"("enabled");

-- CreateIndex
CREATE INDEX "PluginTool_pluginId_idx" ON "PluginTool"("pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "PluginTool_pluginId_name_key" ON "PluginTool"("pluginId", "name");

-- AddForeignKey
ALTER TABLE "Plugin" ADD CONSTRAINT "Plugin_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plugin" ADD CONSTRAINT "Plugin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PluginTool" ADD CONSTRAINT "PluginTool_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
