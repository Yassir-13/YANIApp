-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_codes_user_id_purpose_idx" ON "verification_codes"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comptes antérieurs à la vérification : considérés vérifiés d'office.
-- Sans cette reprise, toutes les clientes déjà inscrites basculeraient
-- "non vérifiées" du jour au lendemain et se verraient réclamer un code
-- pour une adresse qu'elles utilisent parfois depuis des mois.
-- On date la preuve à leur inscription, faute de mieux.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
