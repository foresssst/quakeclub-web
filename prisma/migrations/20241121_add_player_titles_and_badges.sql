-- CreateTable
CREATE TABLE "PlayerTitle" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleUrl" TEXT,
    "titleColor" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PlayerTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerBadge" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "badgeUrl" TEXT,
    "category" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PlayerBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerTitle_playerId_idx" ON "PlayerTitle"("playerId");
CREATE INDEX "PlayerTitle_isActive_idx" ON "PlayerTitle"("isActive");
CREATE INDEX "PlayerTitle_priority_idx" ON "PlayerTitle"("priority");

-- CreateIndex
CREATE INDEX "PlayerBadge_playerId_idx" ON "PlayerBadge"("playerId");
CREATE INDEX "PlayerBadge_category_idx" ON "PlayerBadge"("category");
CREATE INDEX "PlayerBadge_awardedAt_idx" ON "PlayerBadge"("awardedAt");

-- AddForeignKey
ALTER TABLE "PlayerTitle" ADD CONSTRAINT "PlayerTitle_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerBadge" ADD CONSTRAINT "PlayerBadge_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
