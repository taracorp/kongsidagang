-- AlterTable
ALTER TABLE "merchant_products" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'evoucher',
ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valid_days" INTEGER NOT NULL DEFAULT 90;
-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "description" TEXT,
ADD COLUMN     "hours" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsapp" TEXT;
-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "branch_id" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "merchant_id" TEXT,
ADD COLUMN     "order_item_id" TEXT,
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "redeemed_at" TIMESTAMP(3),
ADD COLUMN     "redeemed_by" TEXT;
-- CreateTable
CREATE TABLE "merchant_branches" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_branches_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "bea" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'lunas',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "merchant_id" TEXT,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "merchant_branches_merchant_id_idx" ON "merchant_branches"("merchant_id");
-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);
-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);
-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");
-- CreateIndex
CREATE INDEX "vouchers_merchant_id_status_idx" ON "vouchers"("merchant_id", "status");
-- AddForeignKey
ALTER TABLE "merchant_branches" ADD CONSTRAINT "merchant_branches_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "merchant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "merchant_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "merchant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aturan data lapak & e-voucher.
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_status_check" CHECK ("status" IN ('buka','obral','tutup','segera'));
ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_kind_check" CHECK ("kind" IN ('evoucher','barang'));
ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_valid_days_check" CHECK ("valid_days" BETWEEN 1 AND 730);
ALTER TABLE "merchant_products" ADD CONSTRAINT "merchant_products_price_pos" CHECK ("price" > 0);
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_status_check" CHECK ("status" IN ('aktif','terpakai','kadaluarsa'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("subtotal" > 0 AND "bea" >= 0 AND "total" = "subtotal" + "bea");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_check" CHECK ("qty" BETWEEN 1 AND 20 AND "unit_price" > 0);

-- Voucher lama (mis. hadiah lelang) diberi kode tebus. Huruf ambigu (0/1) diganti agar mudah dibaca petugas.
UPDATE "vouchers"
SET "code" = translate(upper(substr(md5(random()::text || "id"), 1, 10)), '01', 'XY')
WHERE "code" IS NULL;
