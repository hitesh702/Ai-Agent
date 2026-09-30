-- AppointmentStatus gains CONFIRMED (stored as TEXT on SQLite, so no column change).

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "callId" TEXT,
    "agentId" TEXT,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "endAt" DATETIME,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "slotKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("businessId", "callId", "createdAt", "date", "id", "leadId", "notes", "status", "time", "type", "updatedAt") SELECT "businessId", "callId", "createdAt", "date", "id", "leadId", "notes", "status", "time", "type", "createdAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE UNIQUE INDEX "Appointment_slotKey_key" ON "Appointment"("slotKey");
CREATE INDEX "Appointment_businessId_idx" ON "Appointment"("businessId");
CREATE INDEX "Appointment_leadId_idx" ON "Appointment"("leadId");
CREATE INDEX "Appointment_callId_idx" ON "Appointment"("callId");
CREATE INDEX "Appointment_agentId_idx" ON "Appointment"("agentId");
CREATE INDEX "Appointment_businessId_date_idx" ON "Appointment"("businessId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
