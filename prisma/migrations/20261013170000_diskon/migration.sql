-- AlterTable
ALTER TABLE "auctions" ADD COLUMN     "durasi_kumpul" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "durasi_tebak" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "diskon_lapak_unit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diskon_platform_unit" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "diskon_lapak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diskon_platform" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "diskon" (
    "id" TEXT NOT NULL,
    "pembuat" TEXT NOT NULL,
    "merchant_id" TEXT,
    "nama" TEXT NOT NULL,
    "kode" TEXT,
    "perlu_klaim" BOOLEAN NOT NULL DEFAULT false,
    "jenis" TEXT NOT NULL,
    "nilai" INTEGER NOT NULL,
    "maks_potongan" INTEGER,
    "produk_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "merchant_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "min_belanja" INTEGER NOT NULL DEFAULT 0,
    "mulai_at" TIMESTAMP(3),
    "selesai_at" TIMESTAMP(3),
    "kuota_total" INTEGER,
    "kuota_per_user" INTEGER NOT NULL DEFAULT 1,
    "hanya_pembeli_baru" BOOLEAN NOT NULL DEFAULT false,
    "anggaran" INTEGER,
    "terpakai_count" INTEGER NOT NULL DEFAULT 0,
    "terpakai_rupiah" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_oleh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diskon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diskon_klaim" (
    "diskon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diskon_klaim_pkey" PRIMARY KEY ("diskon_id","user_id")
);

-- CreateTable
CREATE TABLE "pemakaian_diskon" (
    "id" TEXT NOT NULL,
    "diskon_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "potongan" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'dicadangkan',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pemakaian_diskon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "diskon_kode_key" ON "diskon"("kode");

-- CreateIndex
CREATE INDEX "diskon_pembuat_aktif_idx" ON "diskon"("pembuat", "aktif");

-- CreateIndex
CREATE INDEX "diskon_merchant_id_idx" ON "diskon"("merchant_id");

-- CreateIndex
CREATE INDEX "pemakaian_diskon_order_id_idx" ON "pemakaian_diskon"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pemakaian_diskon_diskon_id_order_id_key" ON "pemakaian_diskon"("diskon_id", "order_id");

-- AddForeignKey
ALTER TABLE "diskon" ADD CONSTRAINT "diskon_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diskon_klaim" ADD CONSTRAINT "diskon_klaim_diskon_id_fkey" FOREIGN KEY ("diskon_id") REFERENCES "diskon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pemakaian_diskon" ADD CONSTRAINT "pemakaian_diskon_diskon_id_fkey" FOREIGN KEY ("diskon_id") REFERENCES "diskon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Diskon & durasi lelang (Ch 8.44) =====
ALTER TABLE "orders" DROP CONSTRAINT "orders_total_check";
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check"
  CHECK ("subtotal" > 0 AND "bea" >= 0 AND "biaya_bayar" >= 0 AND "diskon_lapak" >= 0 AND "diskon_platform" >= 0
    AND "diskon_lapak" + "diskon_platform" <= "subtotal"
    AND "total" = "subtotal" - "diskon_lapak" - "diskon_platform" + "bea" + "biaya_bayar");
ALTER TABLE "diskon" ADD CONSTRAINT "diskon_check"
  CHECK ("pembuat" IN ('platform','lapak') AND "jenis" IN ('persen','potongan') AND "nilai" > 0
    AND ("jenis" <> 'persen' OR "nilai" <= 100) AND "min_belanja" >= 0 AND "kuota_per_user" >= 1
    AND ("pembuat" <> 'lapak' OR "merchant_id" IS NOT NULL));
ALTER TABLE "pemakaian_diskon" ADD CONSTRAINT "pemakaian_diskon_check"
  CHECK ("potongan" >= 0 AND "status" IN ('dicadangkan','dipakai','dilepas'));
