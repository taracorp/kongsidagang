-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "rek_atas_nama" TEXT,
ADD COLUMN     "rek_bank" TEXT,
ADD COLUMN     "rek_nomor" TEXT;

-- AlterTable
ALTER TABLE "transfer_keluar" ADD COLUMN     "merchant_id" TEXT;

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "dikembalikan_at" TIMESTAMP(3),
ADD COLUMN     "komplain_status" TEXT,
ADD COLUMN     "setoran_id" TEXT;

-- CreateTable
CREATE TABLE "komplain_voucher" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'terbuka',
    "putus_oleh" TEXT,
    "putus_alasan" TEXT,
    "putus_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "komplain_voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setoran_lapak" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "nominal_kotor" INTEGER NOT NULL,
    "potongan" INTEGER NOT NULL DEFAULT 0,
    "nominal" INTEGER NOT NULL,
    "jumlah_voucher" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'antri',
    "transfer_id" TEXT,
    "dibuat_oleh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dibayar_at" TIMESTAMP(3),

    CONSTRAINT "setoran_lapak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potongan_lapak" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "voucher_id" TEXT,
    "nominal" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "setoran_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "potongan_lapak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "komplain_voucher_status_created_at_idx" ON "komplain_voucher"("status", "created_at");

-- CreateIndex
CREATE INDEX "komplain_voucher_voucher_id_idx" ON "komplain_voucher"("voucher_id");

-- CreateIndex
CREATE INDEX "setoran_lapak_merchant_id_created_at_idx" ON "setoran_lapak"("merchant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "potongan_lapak_merchant_id_setoran_id_idx" ON "potongan_lapak"("merchant_id", "setoran_id");

-- AddForeignKey
ALTER TABLE "setoran_lapak" ADD CONSTRAINT "setoran_lapak_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potongan_lapak" ADD CONSTRAINT "potongan_lapak_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Setoran lapak & refund belanja (Ch 8.37) =====
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_status_check";
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_status_check" CHECK ("status" IN ('aktif','terpakai','kadaluarsa','dikembalikan'));
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_komplain_check"
  CHECK ("komplain_status" IS NULL OR "komplain_status" IN ('terbuka','diterima','ditolak'));
ALTER TABLE "komplain_voucher" ADD CONSTRAINT "komplain_voucher_status_check" CHECK ("status" IN ('terbuka','diterima','ditolak'));
ALTER TABLE "setoran_lapak" ADD CONSTRAINT "setoran_lapak_check"
  CHECK ("nominal" > 0 AND "potongan" >= 0 AND "nominal" = "nominal_kotor" - "potongan" AND "status" IN ('antri','dibayar'));
ALTER TABLE "potongan_lapak" ADD CONSTRAINT "potongan_lapak_nominal_check" CHECK ("nominal" > 0);
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_rek_check" CHECK ("rek_nomor" IS NULL OR "rek_nomor" ~ '^[0-9]{5,20}$');
