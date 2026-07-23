-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "price_at_booking" DECIMAL(10,2);

-- Backfill : les RDV créés avant cette colonne reçoivent le prix ACTUEL de leur
-- prestation. C'est une estimation (le vrai prix de réservation est inconnu),
-- mais elle évite des NULL et donne un point de départ cohérent.
UPDATE "appointments" a
SET "price_at_booking" = s."price"
FROM "services" s
WHERE a."service_id" = s."id"
  AND a."price_at_booking" IS NULL;
