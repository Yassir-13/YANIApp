-- CreateEnum
CREATE TYPE "VoucherSource" AS ENUM ('MILESTONE', 'REDEEM');

-- CreateTable
CREATE TABLE "reward_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "source" "VoucherSource" NOT NULL,
    "points_spent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "honored_at" TIMESTAMP(3),
    "honored_by" TEXT,
    "grant_id" TEXT,
    "transaction_id" TEXT,

    CONSTRAINT "reward_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_vouchers_code_key" ON "reward_vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "reward_vouchers_grant_id_key" ON "reward_vouchers"("grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_vouchers_transaction_id_key" ON "reward_vouchers"("transaction_id");

-- CreateIndex
CREATE INDEX "reward_vouchers_account_id_idx" ON "reward_vouchers"("account_id");

-- CreateIndex
CREATE INDEX "reward_vouchers_honored_at_idx" ON "reward_vouchers"("honored_at");

-- AddForeignKey
ALTER TABLE "reward_vouchers" ADD CONSTRAINT "reward_vouchers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_vouchers" ADD CONSTRAINT "reward_vouchers_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_vouchers" ADD CONSTRAINT "reward_vouchers_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "milestone_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_vouchers" ADD CONSTRAINT "reward_vouchers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "loyalty_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_vouchers" ADD CONSTRAINT "reward_vouchers_honored_by_fkey" FOREIGN KEY ("honored_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
--  REPRISE DES DONNÉES EXISTANTES
-- ─────────────────────────────────────────────────────────────────────────
-- Avant cette table, ce qui était dû à une cliente n'était nulle part : une
-- récompense réclamée disparaissait de l'app ET de la fiche comptoir, et un
-- échange de points ne laissait qu'une ligne d'historique que personne ne
-- listait. Sans cette reprise, tout ce qui est « en vol » au moment de la
-- migration serait perdu pour de bon.
--
-- Le code est tiré au sort en SQL sur le même principe que côté application :
-- 8 caractères, sans O/0/I/1 qu'on confond en les dictant. L'index unique
-- ferait échouer la migration en cas de collision — préférable à un doublon
-- silencieux.

-- 1. Récompenses offertes déjà réclamées, jamais remises formellement.
INSERT INTO "reward_vouchers" ("id", "code", "account_id", "reward_id", "source", "points_spent", "created_at", "grant_id")
SELECT
  gen_random_uuid()::text,
  upper(translate(substr(md5(random()::text || clock_timestamp()::text), 1, 8), '01', 'WX')),
  g."account_id",
  g."reward_id",
  'MILESTONE'::"VoucherSource",
  0,
  g."claimed_at",
  g."id"
FROM "milestone_grants" g
WHERE g."claimed_at" IS NOT NULL;

-- 2. Échanges de points : la cliente a payé, l'institut lui doit toujours.
INSERT INTO "reward_vouchers" ("id", "code", "account_id", "reward_id", "source", "points_spent", "created_at", "transaction_id")
SELECT
  gen_random_uuid()::text,
  upper(translate(substr(md5(random()::text || clock_timestamp()::text), 1, 8), '01', 'WX')),
  t."account_id",
  t."reward_id",
  'REDEEM'::"VoucherSource",
  -t."points_delta",
  t."created_at",
  t."id"
FROM "loyalty_transactions" t
WHERE t."type" = 'REDEEM' AND t."reward_id" IS NOT NULL;
