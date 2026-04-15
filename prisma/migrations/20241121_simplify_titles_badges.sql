-- Migración para simplificar PlayerTitle y PlayerBadge
-- Eliminar diseño de biblioteca y usar diseño directo

-- 1. Eliminar restricciones de foreign key de PlayerTitle
ALTER TABLE "PlayerTitle" DROP CONSTRAINT IF EXISTS "PlayerTitle_titleId_fkey";
ALTER TABLE "PlayerTitle" DROP CONSTRAINT IF EXISTS "PlayerTitle_playerId_titleId_key";

-- 2. Eliminar columna titleId y agregar columnas de título directo
ALTER TABLE "PlayerTitle" DROP COLUMN IF EXISTS "titleId";
ALTER TABLE "PlayerTitle" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "PlayerTitle" ADD COLUMN IF NOT EXISTS "titleUrl" TEXT;
ALTER TABLE "PlayerTitle" ADD COLUMN IF NOT EXISTS "titleColor" TEXT;
ALTER TABLE "PlayerTitle" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Actualizar índices de PlayerTitle
DROP INDEX IF EXISTS "PlayerTitle_titleId_idx";

-- 4. Eliminar restricciones de foreign key de PlayerBadge
ALTER TABLE "PlayerBadge" DROP CONSTRAINT IF EXISTS "PlayerBadge_badgeId_fkey";
ALTER TABLE "PlayerBadge" DROP CONSTRAINT IF EXISTS "PlayerBadge_playerId_badgeId_key";

-- 5. Eliminar columna badgeId y agregar columnas de badge directo
ALTER TABLE "PlayerBadge" DROP COLUMN IF EXISTS "badgeId";
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "badgeUrl" TEXT;
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "PlayerBadge" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 6. Actualizar índices de PlayerBadge
DROP INDEX IF EXISTS "PlayerBadge_badgeId_idx";
CREATE INDEX IF NOT EXISTS "PlayerBadge_category_idx" ON "PlayerBadge"("category");

-- 7. Eliminar tablas de biblioteca (Title y Badge) si existen
DROP TABLE IF EXISTS "Title" CASCADE;
DROP TABLE IF EXISTS "Badge" CASCADE;
