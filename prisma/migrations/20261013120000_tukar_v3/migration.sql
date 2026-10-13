-- AlterTable
ALTER TABLE "barter_deals" ADD COLUMN     "biaya_transfer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bukti_url" TEXT,
ADD COLUMN     "cadangan" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eskalasi_at" TIMESTAMP(3),
ADD COLUMN     "pengingat_bayar_at" TIMESTAMP(3),
ADD COLUMN     "pengingat_konfirmasi" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "putus_alasan" TEXT,
ADD COLUMN     "putus_at" TIMESTAMP(3),
ADD COLUMN     "putus_oleh" TEXT,
ADD COLUMN     "selisih_biaya_doku" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "selisih_invoice" TEXT,
ADD COLUMN     "selisih_status" TEXT,
ADD COLUMN     "selisih_uang" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sengketa_at" TIMESTAMP(3),
ADD COLUMN     "setor_a_at" TIMESTAMP(3),
ADD COLUMN     "setor_b_at" TIMESTAMP(3),
ADD COLUMN     "versi" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "topup_orders" ADD COLUMN     "rekber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rekening_user" (
    "user_id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "atas_nama" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rekening_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "transfer_keluar" (
    "id" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "biaya" INTEGER NOT NULL DEFAULT 0,
    "deal_id" TEXT,
    "ref" TEXT,
    "keterangan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'antri',
    "tenggat" TIMESTAMP(3) NOT NULL,
    "bank" TEXT,
    "nomor" TEXT,
    "atas_nama" TEXT,
    "referensi" TEXT,
    "dibayar_at" TIMESTAMP(3),
    "dibayar_oleh" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_keluar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanksi_tukar" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "jenis" TEXT NOT NULL,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanksi_tukar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfer_keluar_status_tenggat_idx" ON "transfer_keluar"("status", "tenggat");

-- CreateIndex
CREATE INDEX "transfer_keluar_user_id_idx" ON "transfer_keluar"("user_id");

-- CreateIndex
CREATE INDEX "transfer_keluar_deal_id_idx" ON "transfer_keluar"("deal_id");

-- CreateIndex
CREATE INDEX "sanksi_tukar_user_id_created_at_idx" ON "sanksi_tukar"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "rekening_user" ADD CONSTRAINT "rekening_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanksi_tukar" ADD CONSTRAINT "sanksi_tukar_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===== Tukar Guling v3 (Ch 8.35) =====
-- Deal yang sudah ada memakai alur lama.
UPDATE "barter_deals" SET "versi" = 2;

ALTER TABLE "barter_deals" DROP CONSTRAINT "barter_deals_status_check";
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_status_check"
  CHECK ("status" IN ('proposed','menunggu_bayar','agreed','dikirim','diterima','done','rejected','cancelled','expired','disputed','resolved'));
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_selisih_check"
  CHECK ("selisih_uang" >= 0 AND "biaya_transfer" >= 0 AND "cadangan" >= 0 AND "selisih_biaya_doku" >= 0
    AND ("selisih_status" IS NULL OR "selisih_status" IN ('ditahan','dicairkan','dikembalikan')));

ALTER TABLE "wallet_holds" DROP CONSTRAINT "wallet_holds_kind_check";
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_kind_check" CHECK ("kind" IN ('bea','tambah','deposit','ongkir','cadangan'));

-- Tagihan DOKU bisa berisi uang rekber (selisih) selain Keteng.
ALTER TABLE "topup_orders" DROP CONSTRAINT "topup_orders_amount_pos";
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_amount_pos"
  CHECK ("price" > 0 AND "keteng" >= 0 AND "rekber" >= 0 AND "keteng" + "rekber" > 0);
ALTER TABLE "topup_orders" DROP CONSTRAINT "topup_orders_biaya_check";
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_biaya_check"
  CHECK ("biaya_bayar" >= 0 AND ("biaya_bayar" = 0 OR "price" = "keteng" + "rekber" + "biaya_bayar"));
ALTER TABLE "topup_orders" DROP CONSTRAINT "topup_orders_tujuan_check";
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_tujuan_check"
  CHECK ("tujuan" IN ('isi', 'belanja', 'tukar_ajukan', 'tukar_terima', 'tukar_ongkir', 'tukar_setor'));

ALTER TABLE "rekening_user" ADD CONSTRAINT "rekening_user_check"
  CHECK ("nomor" ~ '^[0-9]{5,20}$' AND length("atas_nama") BETWEEN 3 AND 60 AND length("bank") BETWEEN 2 AND 40);

ALTER TABLE "transfer_keluar" ADD CONSTRAINT "transfer_keluar_check"
  CHECK ("nominal" > 0 AND "biaya" >= 0
    AND "jenis" IN ('pencairan_selisih','refund_selisih','setoran_lapak','refund_belanja','klaim_asuransi')
    AND "status" IN ('antri','dibayar','batal'));
-- Anti-dobel pencairan/pengembalian selisih dijaga di kode (selisih_status ditahan → dicairkan/dikembalikan, atomik).

ALTER TABLE "sanksi_tukar" ADD CONSTRAINT "sanksi_tukar_jenis_check"
  CHECK ("jenis" IN ('tidak_bayar','batal_sepihak','barang_tidak_sesuai','putusan_syahbandar'));
