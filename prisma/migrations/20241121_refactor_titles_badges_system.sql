-- Migración: Refactorizar sistema de títulos y badges a modelos reutilizables
-- Fecha: 2024-11-21

BEGIN;

-- ============================================
-- PASO 1: Crear nuevas tablas
-- ============================================

-- Tabla de títulos globales
CREATE TABLE IF NOT EXISTS "Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "titleUrl" TEXT,
    "titleColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT
);

CREATE INDEX IF NOT EXISTS "Title_name_idx" ON "Title"("name");

-- Tabla de badges globales
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

CREATE INDEX IF NOT EXISTS "Badge_name_idx" ON "Badge"("name");
CREATE INDEX IF NOT EXISTS "Badge_category_idx" ON "Badge"("category");

-- ============================================
-- PASO 2: Renombrar tablas antiguas temporalmente
-- ============================================

ALTER TABLE IF EXISTS "PlayerTitle" RENAME TO "PlayerTitle_old";
ALTER TABLE IF EXISTS "PlayerBadge" RENAME TO "PlayerBadge_old";

-- ============================================
-- PASO 3: Crear nuevas tablas de relación
-- ============================================

-- Nueva tabla PlayerTitle (relación)
CREATE TABLE "PlayerTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "PlayerTitle_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerTitle_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerTitle_playerId_titleId_key" UNIQUE("playerId", "titleId")
);

CREATE INDEX "PlayerTitle_playerId_idx" ON "PlayerTitle"("playerId");
CREATE INDEX "PlayerTitle_titleId_idx" ON "PlayerTitle"("titleId");
CREATE INDEX "PlayerTitle_isActive_idx" ON "PlayerTitle"("isActive");
CREATE INDEX "PlayerTitle_priority_idx" ON "PlayerTitle"("priority");

-- Nueva tabla PlayerBadge (relación)
CREATE TABLE "PlayerBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "PlayerBadge_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerBadge_playerId_badgeId_key" UNIQUE("playerId", "badgeId")
);

CREATE INDEX "PlayerBadge_playerId_idx" ON "PlayerBadge"("playerId");
CREATE INDEX "PlayerBadge_badgeId_idx" ON "PlayerBadge"("badgeId");
CREATE INDEX "PlayerBadge_awardedAt_idx" ON "PlayerBadge"("awardedAt");

-- ============================================
-- PASO 4: Migrar datos existentes
-- ============================================

-- Migrar títulos (si existen datos antiguos)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'PlayerTitle_old') THEN
        -- Insertar títulos únicos en la tabla Title
        INSERT INTO "Title" ("id", "name", "titleUrl", "titleColor", "createdAt", "createdBy")
        SELECT
            gen_random_uuid()::text,
            title,
            titleUrl,
            titleColor,
            MIN("createdAt"),
            MIN("createdBy")
        FROM "PlayerTitle_old"
        GROUP BY title, titleUrl, titleColor
        ON CONFLICT (name) DO NOTHING;

        -- Insertar relaciones PlayerTitle
        INSERT INTO "PlayerTitle" ("id", "playerId", "titleId", "priority", "isActive", "awardedAt", "createdBy")
        SELECT
            pt_old."id",
            pt_old."playerId",
            t."id" as "titleId",
            pt_old."priority",
            pt_old."isActive",
            pt_old."awardedAt",
            pt_old."createdBy"
        FROM "PlayerTitle_old" pt_old
        INNER JOIN "Title" t ON t."name" = pt_old."title"
        ON CONFLICT ("playerId", "titleId") DO NOTHING;
    END IF;
END $$;

-- Migrar badges (si existen datos antiguos)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'PlayerBadge_old') THEN
        -- Insertar badges únicos en la tabla Badge
        INSERT INTO "Badge" ("id", "name", "description", "imageUrl", "badgeUrl", "category", "createdAt", "createdBy")
        SELECT
            gen_random_uuid()::text,
            name,
            description,
            imageUrl,
            badgeUrl,
            category,
            MIN("createdAt"),
            MIN("createdBy")
        FROM "PlayerBadge_old"
        GROUP BY name, description, imageUrl, badgeUrl, category
        ON CONFLICT (name) DO NOTHING;

        -- Insertar relaciones PlayerBadge
        INSERT INTO "PlayerBadge" ("id", "playerId", "badgeId", "awardedAt", "createdBy")
        SELECT
            pb_old."id",
            pb_old."playerId",
            b."id" as "badgeId",
            pb_old."awardedAt",
            pb_old."createdBy"
        FROM "PlayerBadge_old" pb_old
        INNER JOIN "Badge" b ON b."name" = pb_old."name"
        ON CONFLICT ("playerId", "badgeId") DO NOTHING;
    END IF;
END $$;

-- ============================================
-- PASO 5: Eliminar tablas antiguas
-- ============================================

DROP TABLE IF EXISTS "PlayerTitle_old";
DROP TABLE IF EXISTS "PlayerBadge_old";

COMMIT;
