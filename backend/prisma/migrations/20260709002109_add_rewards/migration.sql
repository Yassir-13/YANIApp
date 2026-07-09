-- AlterTable
ALTER TABLE "loyalty_transactions" ADD COLUMN     "reward_id" TEXT;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
