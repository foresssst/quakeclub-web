-- Custom Tournament System Migration
-- Author: Antigravity AI
-- Date: 2025-11-24
-- Description: Adds support for custom tournament system with groups, matchdays, and maps

-- Add new enum types
CREATE TYPE "TournamentType" AS ENUM ('STANDARD', 'CUSTOM_GROUP');
CREATE TYPE "MapStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'VALIDATED');

-- Add custom tournament fields to Tournament table
ALTER TABLE "Tournament" 
  ADD COLUMN "tournamentType" "TournamentType" DEFAULT 'STANDARD',
  ADD COLUMN "groupsCount" INTEGER,
  ADD COLUMN "teamsPerGroup" INTEGER,
  ADD COLUMN "maps PerMatch" INTEGER,
  ADD COLUMN "playoffFormat" TEXT,
  ADD COLUMN "minRosterSize" INTEGER,
  ADD COLUMN "maxRosterSize" INTEGER,
  ADD COLUMN "tournamentRules" TEXT,
  ADD COLUMN "scheduleNotes" TEXT;

-- Add index for tournamentType
CREATE INDEX "Tournament_tournamentType_idx" ON "Tournament"("tournamentType");

-- Add custom fields to TournamentRegistration
ALTER TABLE "TournamentRegistration"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "groupPosition" INTEGER;

-- Add index for groupId
CREATE INDEX "TournamentRegistration_groupId_idx" ON "TournamentRegistration"("groupId");

-- Add custom fields to TournamentMatch
ALTER TABLE "TournamentMatch"
  ADD COLUMN "groupId" TEXT,
  ADD COLUMN "matchdayId" TEXT,
  ADD COLUMN "isPlayoff" BOOLEAN DEFAULT false,
  ADD COLUMN "homeTeamId" TEXT,
  ADD COLUMN "bestOf" INTEGER,
  ADD COLUMN "tentativeDate" TIMESTAMP(3),
  ADD COLUMN "officialDate" TIMESTAMP(3),
  ADD COLUMN "matchNotes" TEXT;

-- Add indexes for TournamentMatch
CREATE INDEX "TournamentMatch_groupId_idx" ON "TournamentMatch"("groupId");
CREATE INDEX "TournamentMatch_matchdayId_idx" ON "TournamentMatch"("matchdayId");

-- Create TournamentGroup table
CREATE TABLE "TournamentGroup" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TournamentGroup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentGroup_tournamentId_idx" ON "TournamentGroup"("tournamentId");

-- Create TournamentMatchday table
CREATE TABLE "TournamentMatchday" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "matchdayNumber" INTEGER NOT NULL,
  "name" TEXT,
  "scheduledDate" TIMESTAMP(3),
  "officialDate" TIMESTAMP(3),
  "notes" TEXT,
  "isReturn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TournamentMatchday_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentMatchday_tournamentId_idx" ON "TournamentMatchday"("tournamentId");

-- Create TournamentMatchMap table
CREATE TABLE "TournamentMatchMap" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "mapNumber" INTEGER NOT NULL,
  "mapName" TEXT NOT NULL,
  "winnerId" TEXT,
  "score1" INTEGER,
  "score2" INTEGER,
  "screenshotUrl" TEXT,
  "notes" TEXT,
  "status" "MapStatus" NOT NULL DEFAULT 'PENDING',
  "playedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "validatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TournamentMatchMap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TournamentMatchMap_matchId_idx" ON "TournamentMatchMap"("matchId");
CREATE INDEX "TournamentMatchMap_status_idx" ON "TournamentMatchMap"("status");

-- Add foreign key constraints
ALTER TABLE "TournamentGroup" ADD CONSTRAINT "TournamentGroup_tournamentId_fkey" 
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentMatchday" ADD CONSTRAINT "TournamentMatchday_tournamentId_fkey" 
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_groupId_fkey" 
  FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_matchdayId_fkey" 
  FOREIGN KEY ("matchdayId") REFERENCES "TournamentMatchday"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TournamentMatchMap" ADD CONSTRAINT "TournamentMatchMap_matchId_fkey" 
  FOREIGN KEY ("matchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentMatchMap" ADD CONSTRAINT "TournamentMatchMap_winnerId_fkey" 
  FOREIGN KEY ("winnerId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_groupId_fkey" 
  FOREIGN KEY ("groupId") REFERENCES "TournamentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional: Update existing tournaments to STANDARD type (if needed)
-- UPDATE "Tournament" SET "tournamentType" = 'STANDARD' WHERE "tournamentType" IS NULL;
