-- AlterTable
ALTER TABLE "MatchStats" ADD COLUMN     "aliveTime" INTEGER,
ADD COLUMN     "rounds" INTEGER,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "team" INTEGER;
