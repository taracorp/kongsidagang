-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "slides" JSONB;

-- CreateTable
CREATE TABLE "auction_usulan" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "slides" JSONB NOT NULL,
    "usul_deal" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'diajukan',
    "catatan" TEXT,
    "dibuat_oleh" TEXT NOT NULL,
    "diputus_oleh" TEXT,
    "auction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auction_usulan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_usulan_merchant_id_idx" ON "auction_usulan"("merchant_id");

-- CreateIndex
CREATE INDEX "auction_usulan_status_idx" ON "auction_usulan"("status");

-- AddForeignKey
ALTER TABLE "auction_usulan" ADD CONSTRAINT "auction_usulan_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_usulan" ADD CONSTRAINT "auction_usulan_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "merchant_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
