-- Sistema de Torneos para QuakeClub
-- Inspirado en Challonge pero integrado nativamente

-- Tabla principal de torneos
CREATE TABLE IF NOT EXISTS "Tournament" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "gameType" TEXT NOT NULL, -- 'duel', 'ca', 'tdm', 'ctf', 'ffa'
  "format" TEXT NOT NULL, -- 'single_elimination', 'double_elimination', 'round_robin', 'swiss'
  "teamBased" BOOLEAN NOT NULL DEFAULT false, -- true para CA/TDM/CTF, false para Duel/FFA
  "maxParticipants" INTEGER NOT NULL DEFAULT 16,
  "status" TEXT NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'registration_open', 'in_progress', 'completed', 'cancelled'
  "registrationOpens" TIMESTAMP(3),
  "registrationCloses" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "rules" TEXT, -- Reglas en markdown
  "prizes" TEXT, -- Premios en markdown
  "imageUrl" TEXT,
  "createdBy" TEXT NOT NULL, -- Steam ID del admin que lo creó
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Inscripciones al torneo
CREATE TABLE IF NOT EXISTS "TournamentRegistration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL, -- 'player' o 'clan'
  "playerId" TEXT, -- Si es inscripción individual
  "clanId" TEXT, -- Si es inscripción de clan
  "seed" INTEGER, -- Seed asignado (1 = mejor seed)
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'checked_in'
  "checkedInAt" TIMESTAMP(3),
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentRegistration_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentRegistration_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Roster de clan para torneos (qué jugadores representan al clan)
CREATE TABLE IF NOT EXISTS "TournamentClanRoster" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "registrationId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "role" TEXT, -- 'captain', 'player', 'substitute'
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentClanRoster_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentClanRoster_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Matches del bracket
CREATE TABLE IF NOT EXISTS "TournamentMatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "round" INTEGER NOT NULL, -- Ronda del torneo
  "matchNumber" INTEGER NOT NULL, -- Número de match en esa ronda
  "bracket" TEXT NOT NULL DEFAULT 'winners', -- 'winners', 'losers', 'grand_finals'
  "participant1Id" TEXT, -- Registration ID del participante 1
  "participant2Id" TEXT, -- Registration ID del participante 2
  "winnerId" TEXT, -- Registration ID del ganador
  "score1" INTEGER, -- Score del participante 1
  "score2" INTEGER, -- Score del participante 2
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'bye'
  "scheduledFor" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "streamUrl" TEXT, -- URL del stream si está siendo transmitido
  "vodUrl" TEXT, -- URL del VOD después del match
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentMatch_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TournamentMatch_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TournamentMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "TournamentRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS "Tournament_status_startsAt_idx" ON "Tournament"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "TournamentRegistration_tournamentId_idx" ON "TournamentRegistration"("tournamentId");
CREATE INDEX IF NOT EXISTS "TournamentRegistration_playerId_idx" ON "TournamentRegistration"("playerId");
CREATE INDEX IF NOT EXISTS "TournamentRegistration_clanId_idx" ON "TournamentRegistration"("clanId");
CREATE INDEX IF NOT EXISTS "TournamentMatch_tournamentId_round_idx" ON "TournamentMatch"("tournamentId", "round");
CREATE INDEX IF NOT EXISTS "TournamentClanRoster_registrationId_idx" ON "TournamentClanRoster"("registrationId");
