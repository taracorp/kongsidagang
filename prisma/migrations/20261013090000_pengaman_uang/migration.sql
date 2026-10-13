-- AlterTable
ALTER TABLE "barter_deals" ADD COLUMN     "scan_fails_a" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scan_fails_b" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "valid_days" INTEGER;

-- CreateTable
CREATE TABLE "pembayaran_bermasalah" (
    "id" TEXT NOT NULL,
    "invoice" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "nominal" INTEGER,
    "keterangan" TEXT NOT NULL,
    "selesai_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pembayaran_bermasalah_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pembayaran_bermasalah_created_at_idx" ON "pembayaran_bermasalah"("created_at" DESC);

