-- AlterTable
ALTER TABLE "barter_shipments" ADD COLUMN     "sorting_code" TEXT;

-- CreateTable
CREATE TABLE "kurir_uji" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "awb" TEXT,
    "sorting_code" TEXT,
    "pickup_number" TEXT,
    "courier" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "skenario" TEXT NOT NULL,
    "pengirim" JSONB NOT NULL,
    "penerima" JSONB NOT NULL,
    "weight_g" INTEGER NOT NULL,
    "length_cm" INTEGER NOT NULL,
    "width_cm" INTEGER NOT NULL,
    "height_cm" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_value" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "shipping_cost" INTEGER NOT NULL,
    "insurance" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "status_text" TEXT,
    "respon" JSONB,
    "dibuat_oleh" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kurir_uji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kurir_webhook_log" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "diproses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kurir_webhook_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kurir_uji_order_id_key" ON "kurir_uji"("order_id");

-- CreateIndex
CREATE INDEX "kurir_webhook_log_created_at_idx" ON "kurir_webhook_log"("created_at" DESC);

