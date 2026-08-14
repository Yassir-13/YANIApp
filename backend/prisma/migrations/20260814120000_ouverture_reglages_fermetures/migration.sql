-- ─────────────────────────────────────────────────────────────
--  HORAIRES : une ligne par PLAGE, plusieurs par jour
-- ─────────────────────────────────────────────────────────────
-- Les horaires déjà saisis sont conservés : chaque jour ouvert devient une
-- plage unique, identique à ce qu'il était. Seuls les jours marqués fermés
-- perdent leur ligne — leurs heures n'étaient que les valeurs par défaut du
-- formulaire, jamais utilisées, et « zéro plage » est désormais ce qui dit
-- qu'un jour est fermé.

ALTER TABLE "opening_hours" RENAME COLUMN "open_time" TO "start_time";
ALTER TABLE "opening_hours" RENAME COLUMN "close_time" TO "end_time";

DELETE FROM "opening_hours" WHERE "is_closed" = true;

ALTER TABLE "opening_hours" DROP COLUMN "is_closed";
ALTER TABLE "opening_hours" DROP COLUMN "updated_at";

-- Un jour ne peut plus être unique : c'est le couple (jour, heure de début)
-- qui l'est. Le chevauchement de deux plages est refusé par le service —
-- aucune contrainte SQL ne sait l'exprimer sans extension.
DROP INDEX "opening_hours_day_of_week_key";
CREATE UNIQUE INDEX "opening_hours_day_of_week_start_time_key" ON "opening_hours"("day_of_week", "start_time");

-- ─────────────────────────────────────────────────────────────
--  FERMETURES EXCEPTIONNELLES
-- ─────────────────────────────────────────────────────────────
-- Bornes en "AAAA-MM-JJ" et non en TIMESTAMP : une fermeture est un JOUR du
-- calendrier local du centre, pas un instant. Un timestamp obligerait à
-- choisir une heure arbitraire et rouvrirait la question du fuseau à chaque
-- lecture.

CREATE TABLE "closures" (
    "id" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "closures_start_date_end_date_idx" ON "closures"("start_date", "end_date");

-- ─────────────────────────────────────────────────────────────
--  RÉGLAGES DU CENTRE
-- ─────────────────────────────────────────────────────────────

CREATE TABLE "center_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "slot_interval_min" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "center_settings_pkey" PRIMARY KEY ("id")
);

-- La ligne unique est créée ici, pas par le seed : une base déjà en service ne
-- rejoue pas le seed, et le moteur de créneaux ne doit jamais tomber sur des
-- réglages absents. Les valeurs reprennent les constantes retirées du code.
INSERT INTO "center_settings" ("id", "capacity", "slot_interval_min", "updated_at")
VALUES (1, 2, 30, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────────────────────
--  FIDÉLITÉ : deux champs que rien n'écrivait (M1, M2)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE "loyalty_accounts" DROP COLUMN "tier";
DROP TYPE "LoyaltyTier";

-- Aucune écriture n'a jamais produit d'ADJUSTMENT. Ce repli est là au cas où
-- une base l'aurait acquis autrement : sans lui, la conversion du type
-- échouerait en pleine migration.
UPDATE "loyalty_transactions" SET "type" = 'MANUAL' WHERE "type" = 'ADJUSTMENT';

-- Postgres ne sait pas retirer une valeur d'un enum : le type est reconstruit.
ALTER TYPE "LoyaltyTxType" RENAME TO "LoyaltyTxType_old";
CREATE TYPE "LoyaltyTxType" AS ENUM ('EARN', 'REDEEM', 'MANUAL', 'MILESTONE');
ALTER TABLE "loyalty_transactions"
  ALTER COLUMN "type" TYPE "LoyaltyTxType" USING ("type"::text::"LoyaltyTxType");
DROP TYPE "LoyaltyTxType_old";
