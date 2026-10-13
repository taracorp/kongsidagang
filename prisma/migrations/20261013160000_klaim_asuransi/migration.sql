-- CreateTable
CREATE TABLE "klaim_asuransi" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "penerima_id" TEXT NOT NULL,
    "nomor_klaim" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'diajukan',
    "nominal_cair" INTEGER,
    "catatan" TEXT,
    "transfer_id" TEXT,
    "dibuat_oleh" TEXT NOT NULL,
    "diputus_oleh" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputus_at" TIMESTAMP(3),

    CONSTRAINT "klaim_asuransi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "klaim_asuransi_shipment_id_key" ON "klaim_asuransi"("shipment_id");

-- CreateIndex
CREATE INDEX "klaim_asuransi_status_idx" ON "klaim_asuransi"("status");

ALTER TABLE "klaim_asuransi" ADD CONSTRAINT "klaim_asuransi_check"
  CHECK ("jenis" IN ('hilang','rusak') AND "status" IN ('diajukan','cair','ditolak') AND ("nominal_cair" IS NULL OR "nominal_cair" > 0));
