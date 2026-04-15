-- AlterTable
ALTER TABLE "MatchStats" ADD COLUMN     "matchGroupId" TEXT;

-- CreateIndex
CREATE INDEX "MatchStats_matchGroupId_idx" ON "MatchStats"("matchGroupId");
