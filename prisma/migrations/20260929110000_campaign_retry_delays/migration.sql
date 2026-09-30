-- Per-outcome retry delays and Campaign.updatedAt.
-- SQLite cannot add a column with a CURRENT_TIMESTAMP default in place, so the
-- table is rebuilt: every existing row is copied into the new table first.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startTime" DATETIME,
    "endTime" DATETIME,
    "callingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "callingWindowStart" TEXT NOT NULL DEFAULT '09:00',
    "callingWindowEnd" TEXT NOT NULL DEFAULT '20:00',
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMinutes" INTEGER NOT NULL DEFAULT 60,
    "busyRetryMinutes" INTEGER NOT NULL DEFAULT 30,
    "failedRetryMinutes" INTEGER NOT NULL DEFAULT 30,
    "retryOnVoicemail" BOOLEAN NOT NULL DEFAULT true,
    "createFollowUps" BOOLEAN NOT NULL DEFAULT true,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Campaign_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("agentId", "businessId", "callingDays", "callingWindowEnd", "callingWindowStart", "createFollowUps", "createdAt", "updatedAt", "endTime", "failureReason", "id", "maxAttempts", "name", "retryDelayMinutes", "retryOnVoicemail", "startTime", "status") SELECT "agentId", "businessId", "callingDays", "callingWindowEnd", "callingWindowStart", "createFollowUps", "createdAt", "createdAt", "endTime", "failureReason", "id", "maxAttempts", "name", "retryDelayMinutes", "retryOnVoicemail", "startTime", "status" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");
CREATE INDEX "Campaign_agentId_idx" ON "Campaign"("agentId");
CREATE INDEX "Campaign_businessId_status_idx" ON "Campaign"("businessId", "status");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
