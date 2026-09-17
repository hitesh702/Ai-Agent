-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT,
    "callId" TEXT,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "skipReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUp_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable Business
ALTER TABLE "Business" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "Business" ADD COLUMN "callingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "followUpCallingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "callingWindowStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Business" ADD COLUMN "callingWindowEnd" TEXT NOT NULL DEFAULT '20:00';
ALTER TABLE "Business" ADD COLUMN "callingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';
ALTER TABLE "Business" ADD COLUMN "maxFollowUpAttempts" INTEGER NOT NULL DEFAULT 3;

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN "followUpRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Call
ALTER TABLE "Call" ADD COLUMN "sourceFollowUpId" TEXT;
CREATE INDEX "Call_sourceFollowUpId_idx" ON "Call"("sourceFollowUpId");

CREATE INDEX "FollowUp_businessId_status_scheduledAt_idx" ON "FollowUp"("businessId", "status", "scheduledAt");
CREATE INDEX "FollowUp_leadId_status_idx" ON "FollowUp"("leadId", "status");
CREATE INDEX "FollowUp_scheduledAt_status_idx" ON "FollowUp"("scheduledAt", "status");
CREATE INDEX "FollowUp_callId_idx" ON "FollowUp"("callId");
