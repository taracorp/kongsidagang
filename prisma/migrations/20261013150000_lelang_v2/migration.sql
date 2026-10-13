-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "batal_alasan" TEXT,
ADD COLUMN     "dibatalkan_oleh" TEXT,
ADD COLUMN     "dibuat_oleh" TEXT,
ADD COLUMN     "dimulai_oleh" TEXT,
ADD COLUMN     "merchant_id" TEXT,
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "selesai_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'draf';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "titipan" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "auction_id" TEXT;

-- CreateTable
CREATE TABLE "auction_hak" (
    "id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "peringkat" INTEGER NOT NULL,
    "guess" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'antri',
    "tenggat" TIMESTAMP(3),
    "order_id" TEXT,
    "pengingat_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_hak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_hak_status_tenggat_idx" ON "auction_hak"("status", "tenggat");

-- CreateIndex
CREATE UNIQUE INDEX "auction_hak_auction_id_peringkat_key" ON "auction_hak"("auction_id", "peringkat");

-- CreateIndex
CREATE UNIQUE INDEX "auction_hak_auction_id_user_id_key" ON "auction_hak"("auction_id", "user_id");

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "merchant_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_hak" ADD CONSTRAINT "auction_hak_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Lelang v2 (Ch 8.39) =====
-- Lelang lama (tanpa produk lapak) tidak bisa dibayar → dibatalkan.
UPDATE "auctions" SET "status" = 'batal', "phase_ends_at" = NULL, "batal_alasan" = 'Lelang lama sebelum v2' WHERE "product_id" IS NULL;
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_status_v2_check"
  CHECK ("status" IN ('draf','kumpul','tebak','jeda','final','pemenang','bayar','selesai','gagal','batal'));
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_harga_check"
  CHECK ("product_id" IS NULL OR ("deal_price" > 0 AND "set_price" >= "deal_price" AND "normal_price" >= "set_price"));
ALTER TABLE "auction_hak" ADD CONSTRAINT "auction_hak_check"
  CHECK ("peringkat" BETWEEN 1 AND 3 AND "status" IN ('antri','menunggu','lunas','hangus'));
