-- AlterTable
ALTER TABLE "WorkspaceUser" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "role" SET DEFAULT 'member';

-- Update existing rows to have default role if NULL
UPDATE "WorkspaceUser" SET "role" = 'member' WHERE "role" IS NULL OR "role" = '';
