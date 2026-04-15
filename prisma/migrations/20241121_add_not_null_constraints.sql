-- Agregar restricciones NOT NULL a campos obligatorios

-- PlayerTitle: hacer campos obligatorios NOT NULL
ALTER TABLE "PlayerTitle" ALTER COLUMN "title" SET NOT NULL;

-- PlayerBadge: hacer campos obligatorios NOT NULL
ALTER TABLE "PlayerBadge" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "PlayerBadge" ALTER COLUMN "imageUrl" SET NOT NULL;
