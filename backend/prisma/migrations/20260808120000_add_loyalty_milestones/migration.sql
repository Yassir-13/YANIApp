-- AlterEnum
ALTER TYPE "LoyaltyTxType" ADD VALUE 'MILESTONE';

-- CreateTable
CREATE TABLE "loyalty_milestones" (
    "id" TEXT NOT NULL,
    "visit_threshold" INTEGER NOT NULL,
    "reward_id" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_grants" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_grants_account_id_idx" ON "milestone_grants"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_grants_account_id_milestone_id_cycle_key" ON "milestone_grants"("account_id", "milestone_id", "cycle");

-- AddForeignKey
ALTER TABLE "loyalty_milestones" ADD CONSTRAINT "loyalty_milestones_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_grants" ADD CONSTRAINT "milestone_grants_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_grants" ADD CONSTRAINT "milestone_grants_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "loyalty_milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone_grants" ADD CONSTRAINT "milestone_grants_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Recalage de visit_count : une visite = une prestation réalisée à l'institut.
-- Les commandes de produits n'incrémentent plus le compteur, mais les comptes
-- existants les ont déjà comptées. On repart des mouvements EARN rattachés à un
-- rendez-vous, seule trace fiable d'une visite. Les prestations trop peu chères
-- pour rapporter un point n'ont jamais créé de mouvement : elles restent hors
-- du compte, ce qui est le comportement voulu.
UPDATE "loyalty_accounts" a
SET "visit_count" = (
    SELECT COUNT(*)
    FROM "loyalty_transactions" t
    WHERE t."account_id" = a."id"
      AND t."type" = 'EARN'
      AND t."appointment_id" IS NOT NULL
);
