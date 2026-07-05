-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "key" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "SuperAdminAuditLog_createdAt_idx" ON "SuperAdminAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SuperAdminAuditLog" ADD CONSTRAINT "SuperAdminAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

