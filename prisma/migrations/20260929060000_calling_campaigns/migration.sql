-- AlterTable Campaign
ALTER TABLE "Campaign" ADD COLUMN "callingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6';
ALTER TABLE "Campaign" ADD COLUMN "callingWindowStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Campaign" ADD COLUMN "callingWindowEnd" TEXT NOT NULL DEFAULT '20:00';
ALTER TABLE "Campaign" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Campaign" ADD COLUMN "retryDelayMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Campaign" ADD COLUMN "retryOnVoicemail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "createFollowUps" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Campaign" ADD COLUMN "failureReason" TEXT;
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- AlterTable Business
ALTER TABLE "Business" ADD COLUMN "callQueueLockedUntil" DATETIME;

-- Legacy ACTIVE campaigns never dialed; park them as PAUSED so dialing needs an explicit resume.
UPDATE "Campaign" SET "status" = 'PAUSED' WHERE "status" = 'ACTIVE';

-- AlterTable CampaignLead
ALTER TABLE "CampaignLead" ADD COLUMN "lastOutcome" TEXT;

-- AlterTable Call
ALTER TABLE "Call" ADD COLUMN "endedReason" TEXT;
ALTER TABLE "Call" ADD COLUMN "campaignLeadId" TEXT REFERENCES "CampaignLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Call_campaignLeadId_idx" ON "Call"("campaignLeadId");

-- AlterTable Lead
ALTER TABLE "Lead" ADD COLUMN "doNotCall" BOOLEAN NOT NULL DEFAULT false;
