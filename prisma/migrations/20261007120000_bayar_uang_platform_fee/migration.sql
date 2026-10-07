-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "biaya_bayar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "invoice_number" TEXT,
ADD COLUMN     "metode" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_url" TEXT,
ADD COLUMN     "provider" TEXT,
ALTER COLUMN "status" SET DEFAULT 'menunggu';

-- AlterTable
ALTER TABLE "topup_orders" ADD COLUMN     "biaya_bayar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoice_number_key" ON "orders"("invoice_number");


-- Belanja kini dibayar uang lewat DOKU: total = harga voucher + platform fee + biaya DOKU.
ALTER TABLE "orders" DROP CONSTRAINT "orders_total_check";
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check"
  CHECK ("subtotal" > 0 AND "bea" >= 0 AND "biaya_bayar" >= 0 AND "total" = "subtotal" + "bea" + "biaya_bayar");
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check"
  CHECK ("status" IN ('menunggu', 'lunas', 'gagal', 'kedaluwarsa'));
-- Isi Pundi tanpa bonus: dibayar = Keteng + biaya DOKU (baris lama biaya_bayar = 0 tetap sah).
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_biaya_check"
  CHECK ("biaya_bayar" >= 0 AND ("biaya_bayar" = 0 OR "price" = "keteng" + "biaya_bayar"));
