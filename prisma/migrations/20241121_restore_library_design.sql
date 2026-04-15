-- Restaurar diseño de biblioteca para títulos y badges

-- 1. Crear tabla Title (biblioteca global de títulos)
CREATE TABLE IF NOT EXISTS "Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "titleUrl" TEXT,
    "titleColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
);

-- 2. Crear tabla Badge (biblioteca global de badges)
CREATE TABLE IF NOT EXISTS "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "badgeUrl" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
);

-- 3. Modificar PlayerTitle para usar titleId en lugar de campos directos
ALTER TABLE "PlayerTitle" ADD COLUMN IF NOT EXISTS "titleId" TEXT;
ALTER TABLE "PlayerTitle" DROP COLUMN IF EXISTS "title";
ALTER TABLE "PlayerTitle" DROP COLUMN IF EXISTS "titleUrl";
ALTER TABLE "PlayerTitle" DROP COLUMN IF EXISTS "titleColor";

-- 4. Modificar PlayerBadge para usar badgeId en lugar de campos directos
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "badgeId" TEXT;
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "name";
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "description";
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "imageUrl";
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "badgeUrl";
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "category";

-- 5. Agregar foreign keys
ALTER TABLE "PlayerTitle" ADD CONSTRAINT "PlayerTitle_titleId_fkey" 
    FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerBadge" ADD CONSTRAINT "PlayerBadge_badgeId_fkey" 
    FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Agregar índices
CREATE INDEX IF NOT EXISTS "PlayerTitle_titleId_idx" ON "PlayerTitle"("titleId");
CREATE INDEX IF NOT EXISTS "PlayerBadge_badgeId_idx" ON "PlayerBadge"("badgeId");
CREATE INDEX IF NOT EXISTS "Badge_category_idx" ON "Badge"("category");

-- 7. Agregar unique constraint para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerTitle_playerId_titleId_key" ON "PlayerTitle"("playerId", "titleId");
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerBadge_playerId_badgeId_key" ON "PlayerBadge"("playerId", "badgeId");
