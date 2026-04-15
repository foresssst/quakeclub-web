-- CreateTable
CREATE TABLE "PlayerRating" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
    "deviation" DOUBLE PRECISION NOT NULL DEFAULT 350.0,
    "volatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "lastPlayed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerRating_playerId_idx" ON "PlayerRating"("playerId");

-- CreateIndex
CREATE INDEX "PlayerRating_steamId_idx" ON "PlayerRating"("steamId");

-- CreateIndex
CREATE INDEX "PlayerRating_gameType_idx" ON "PlayerRating"("gameType");

-- CreateIndex
CREATE INDEX "PlayerRating_rating_idx" ON "PlayerRating"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRating_steamId_gameType_key" ON "PlayerRating"("steamId", "gameType");

-- AddForeignKey
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
