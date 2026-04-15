-- Agregar campos de banner al modelo Player
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "banner" TEXT;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "bannerOffsetX" INTEGER DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "bannerOffsetY" INTEGER DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "coverPresetId" TEXT;

-- Crear tabla CoverPreset
CREATE TABLE IF NOT EXISTS "CoverPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "CoverPreset_pkey" PRIMARY KEY ("id")
);

-- Crear índices
CREATE UNIQUE INDEX IF NOT EXISTS "CoverPreset_name_key" ON "CoverPreset"("name");
CREATE INDEX IF NOT EXISTS "CoverPreset_active_idx" ON "CoverPreset"("active");
