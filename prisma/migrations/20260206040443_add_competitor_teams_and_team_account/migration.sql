-- CreateTable
CREATE TABLE "TeamCompetitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamAccountId" TEXT NOT NULL,
    "competitorTeamId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamCompetitor_teamAccountId_fkey" FOREIGN KEY ("teamAccountId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamCompetitor_competitorTeamId_fkey" FOREIGN KEY ("competitorTeamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Meet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "location" TEXT,
    "conferenceId" TEXT,
    "teamId" TEXT NOT NULL,
    "teamAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "meetType" TEXT NOT NULL DEFAULT 'championship',
    "maxAthletes" INTEGER NOT NULL DEFAULT 18,
    "diverRatio" REAL NOT NULL DEFAULT 0.333,
    "divingIncluded" BOOLEAN NOT NULL DEFAULT true,
    "maxIndivEvents" INTEGER NOT NULL DEFAULT 3,
    "maxRelays" INTEGER NOT NULL DEFAULT 4,
    "maxDivingEvents" INTEGER NOT NULL DEFAULT 2,
    "scoringType" TEXT NOT NULL DEFAULT 'championship',
    "scoringPlaces" INTEGER NOT NULL DEFAULT 24,
    "scoringStartPoints" INTEGER NOT NULL DEFAULT 32,
    "relayMultiplier" REAL NOT NULL DEFAULT 2.0,
    "individualScoring" TEXT,
    "relayScoring" TEXT,
    "divingScoring" TEXT,
    "selectedEvents" TEXT,
    "eventOrder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meet_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meet_teamAccountId_fkey" FOREIGN KEY ("teamAccountId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Meet_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Meet" ("conferenceId", "createdAt", "date", "diverRatio", "divingIncluded", "divingScoring", "eventOrder", "id", "individualScoring", "location", "maxAthletes", "maxDivingEvents", "maxIndivEvents", "maxRelays", "meetType", "name", "relayMultiplier", "relayScoring", "scoringPlaces", "scoringStartPoints", "scoringType", "selectedEvents", "status", "teamId", "updatedAt") SELECT "conferenceId", "createdAt", "date", "diverRatio", "divingIncluded", "divingScoring", "eventOrder", "id", "individualScoring", "location", "maxAthletes", "maxDivingEvents", "maxIndivEvents", "maxRelays", "meetType", "name", "relayMultiplier", "relayScoring", "scoringPlaces", "scoringStartPoints", "scoringType", "selectedEvents", "status", "teamId", "updatedAt" FROM "Meet";
DROP TABLE "Meet";
ALTER TABLE "new_Meet" RENAME TO "Meet";
CREATE INDEX "Meet_conferenceId_idx" ON "Meet"("conferenceId");
CREATE INDEX "Meet_teamId_idx" ON "Meet"("teamId");
CREATE INDEX "Meet_teamAccountId_idx" ON "Meet"("teamAccountId");
CREATE INDEX "Meet_status_idx" ON "Meet"("status");
CREATE INDEX "Meet_meetType_idx" ON "Meet"("meetType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamCompetitor_teamAccountId_idx" ON "TeamCompetitor"("teamAccountId");

-- CreateIndex
CREATE INDEX "TeamCompetitor_competitorTeamId_idx" ON "TeamCompetitor"("competitorTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCompetitor_teamAccountId_competitorTeamId_key" ON "TeamCompetitor"("teamAccountId", "competitorTeamId");
