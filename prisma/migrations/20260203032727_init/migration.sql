-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "schoolName" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "conferenceId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "year" TEXT,
    "isDiver" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Athlete_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "distance" INTEGER,
    "stroke" TEXT,
    "sortOrder" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "AthleteEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "athleteId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "timeSeconds" REAL NOT NULL,
    "isEntered" BOOLEAN NOT NULL DEFAULT false,
    "isRelaySplit" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AthleteEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AthleteEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME,
    "location" TEXT,
    "conferenceId" TEXT,
    "teamId" TEXT NOT NULL,
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
    CONSTRAINT "Meet_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetCollaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetCollaborator_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "selectedAthletes" TEXT,
    "individualScore" REAL NOT NULL DEFAULT 0,
    "relayScore" REAL NOT NULL DEFAULT 0,
    "divingScore" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "MeetTeam_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetLineup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seedTime" TEXT,
    "seedTimeSeconds" REAL,
    "overrideTime" TEXT,
    "overrideTimeSeconds" REAL,
    "finalTime" TEXT,
    "finalTimeSeconds" REAL,
    "place" INTEGER,
    "points" REAL,
    CONSTRAINT "MeetLineup_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetLineup_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetLineup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RelayEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "seedTime" TEXT,
    "seedTimeSeconds" REAL,
    "overrideTime" TEXT,
    "overrideTimeSeconds" REAL,
    "finalTime" TEXT,
    "finalTimeSeconds" REAL,
    "place" INTEGER,
    "points" REAL,
    "members" TEXT,
    "legTimes" TEXT,
    "useRelaySplits" TEXT,
    CONSTRAINT "RelayEntry_meetId_fkey" FOREIGN KEY ("meetId") REFERENCES "Meet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RelayEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RelayEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetId" TEXT,
    "teamId" TEXT,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Team_conferenceId_idx" ON "Team"("conferenceId");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Athlete_teamId_idx" ON "Athlete"("teamId");

-- CreateIndex
CREATE INDEX "Athlete_lastName_firstName_idx" ON "Athlete"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Event_name_key" ON "Event"("name");

-- CreateIndex
CREATE INDEX "AthleteEvent_athleteId_idx" ON "AthleteEvent"("athleteId");

-- CreateIndex
CREATE INDEX "AthleteEvent_eventId_idx" ON "AthleteEvent"("eventId");

-- CreateIndex
CREATE INDEX "AthleteEvent_timeSeconds_idx" ON "AthleteEvent"("timeSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteEvent_athleteId_eventId_isRelaySplit_key" ON "AthleteEvent"("athleteId", "eventId", "isRelaySplit");

-- CreateIndex
CREATE INDEX "Meet_conferenceId_idx" ON "Meet"("conferenceId");

-- CreateIndex
CREATE INDEX "Meet_teamId_idx" ON "Meet"("teamId");

-- CreateIndex
CREATE INDEX "Meet_status_idx" ON "Meet"("status");

-- CreateIndex
CREATE INDEX "Meet_meetType_idx" ON "Meet"("meetType");

-- CreateIndex
CREATE INDEX "MeetCollaborator_meetId_idx" ON "MeetCollaborator"("meetId");

-- CreateIndex
CREATE INDEX "MeetCollaborator_userId_idx" ON "MeetCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetCollaborator_meetId_userId_key" ON "MeetCollaborator"("meetId", "userId");

-- CreateIndex
CREATE INDEX "MeetTeam_meetId_idx" ON "MeetTeam"("meetId");

-- CreateIndex
CREATE INDEX "MeetTeam_teamId_idx" ON "MeetTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetTeam_meetId_teamId_key" ON "MeetTeam"("meetId", "teamId");

-- CreateIndex
CREATE INDEX "MeetLineup_meetId_idx" ON "MeetLineup"("meetId");

-- CreateIndex
CREATE INDEX "MeetLineup_athleteId_idx" ON "MeetLineup"("athleteId");

-- CreateIndex
CREATE INDEX "MeetLineup_eventId_idx" ON "MeetLineup"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetLineup_meetId_athleteId_eventId_key" ON "MeetLineup"("meetId", "athleteId", "eventId");

-- CreateIndex
CREATE INDEX "RelayEntry_meetId_idx" ON "RelayEntry"("meetId");

-- CreateIndex
CREATE INDEX "RelayEntry_teamId_idx" ON "RelayEntry"("teamId");

-- CreateIndex
CREATE INDEX "RelayEntry_eventId_idx" ON "RelayEntry"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RelayEntry_meetId_teamId_eventId_key" ON "RelayEntry"("meetId", "teamId", "eventId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
