-- CreateTable
CREATE TABLE "topup_orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "keteng" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'doku',
    "payment_url" TEXT,
    "channel" TEXT,
    "paid_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topup_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_invoice_number_key" ON "topup_orders"("invoice_number");

-- CreateIndex
CREATE INDEX "topup_orders_user_id_created_at_idx" ON "topup_orders"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan data Isi Pundi.
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_status_check" CHECK ("status" IN ('pending','paid','failed','expired'));
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_amount_pos" CHECK ("price" > 0 AND "keteng" >= "price");
