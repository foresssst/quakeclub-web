/*
  Warnings:

  - You are about to drop the `Achievement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Clan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClanInvitation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClanMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerAchievement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tournament` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TournamentMatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TournamentParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TournamentTeam` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ClanInvitation" DROP CONSTRAINT "ClanInvitation_clanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClanInvitation" DROP CONSTRAINT "ClanInvitation_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClanMember" DROP CONSTRAINT "ClanMember_clanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ClanMember" DROP CONSTRAINT "ClanMember_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAchievement" DROP CONSTRAINT "PlayerAchievement_achievementId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PlayerAchievement" DROP CONSTRAINT "PlayerAchievement_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentMatch" DROP CONSTRAINT "TournamentMatch_awayTeamId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentMatch" DROP CONSTRAINT "TournamentMatch_homeTeamId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentMatch" DROP CONSTRAINT "TournamentMatch_tournamentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentParticipant" DROP CONSTRAINT "TournamentParticipant_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentParticipant" DROP CONSTRAINT "TournamentParticipant_teamId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentTeam" DROP CONSTRAINT "TournamentTeam_clanId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TournamentTeam" DROP CONSTRAINT "TournamentTeam_tournamentId_fkey";

-- DropTable
DROP TABLE "public"."Achievement";

-- DropTable
DROP TABLE "public"."Clan";

-- DropTable
DROP TABLE "public"."ClanInvitation";

-- DropTable
DROP TABLE "public"."ClanMember";

-- DropTable
DROP TABLE "public"."PlayerAchievement";

-- DropTable
DROP TABLE "public"."Tournament";

-- DropTable
DROP TABLE "public"."TournamentMatch";

-- DropTable
DROP TABLE "public"."TournamentParticipant";

-- DropTable
DROP TABLE "public"."TournamentTeam";

-- DropEnum
DROP TYPE "public"."AchievementTier";

-- DropEnum
DROP TYPE "public"."ClanRole";

-- DropEnum
DROP TYPE "public"."InvitationStatus";

-- DropEnum
DROP TYPE "public"."MatchStatus";

-- DropEnum
DROP TYPE "public"."TournamentStatus";
