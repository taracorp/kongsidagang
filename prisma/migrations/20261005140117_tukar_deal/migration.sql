-- AlterTable
ALTER TABLE "barter_deals" ADD COLUMN     "agreed_at" TIMESTAMP(3),
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "fault_party" TEXT,
ADD COLUMN     "fee_a" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fee_b" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "meet_place" TEXT,
ADD COLUMN     "meet_type" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'cod',
ADD COLUMN     "proposer_id" TEXT,
ADD COLUMN     "scan_fails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scanned_a_at" TIMESTAMP(3),
ADD COLUMN     "scanned_b_at" TIMESTAMP(3),
ADD COLUMN     "topup_from" TEXT,
ADD COLUMN     "value_a" INTEGER,
ADD COLUMN     "value_b" INTEGER;

-- CreateIndex
CREATE INDEX "barter_deals_status_expires_at_idx" ON "barter_deals"("status", "expires_at");

-- Satukan status lama ke kosakata baru.
UPDATE "barter_deals" SET "status" = 'rejected' WHERE "status" = 'ditolak';
UPDATE "barter_deals" SET "status" = 'cancelled' WHERE "status" = 'dibatalkan';
-- Deal lama: proposer = pemilik item A.
UPDATE "barter_deals" d SET "proposer_id" = i."user_id" FROM "barter_items" i WHERE i."id" = d."item_a" AND d."proposer_id" IS NULL;

ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_status_check"
  CHECK ("status" IN ('proposed','agreed','done','rejected','cancelled','expired','disputed','resolved'));
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_mode_check" CHECK ("mode" IN ('cod','kirim'));
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_topup_nonneg" CHECK ("topup_keping" >= 0);
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_topup_from_check" CHECK ("topup_from" IS NULL OR "topup_from" IN ('a','b'));
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_status_check"
  CHECK ("status" IN ('aktif','dalam_tukar','ditutup','ditukar'));
