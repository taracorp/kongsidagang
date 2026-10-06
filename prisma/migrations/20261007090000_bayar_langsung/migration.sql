-- AlterTable
ALTER TABLE "topup_orders" ADD COLUMN     "muatan" JSONB,
ADD COLUMN     "tujuan" TEXT NOT NULL DEFAULT 'isi',
ADD COLUMN     "tujuan_hasil" TEXT,
ADD COLUMN     "tujuan_ref" TEXT,
ADD COLUMN     "tujuan_status" TEXT;


ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_tujuan_check"
  CHECK ("tujuan" IN ('isi', 'belanja', 'tukar_ajukan', 'tukar_terima', 'tukar_ongkir'));
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_tujuan_status_check"
  CHECK ("tujuan_status" IS NULL OR "tujuan_status" IN ('menunggu', 'diproses', 'berhasil', 'gagal'));
