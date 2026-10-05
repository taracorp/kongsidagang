-- AlterTable
ALTER TABLE "barter_categories" ADD COLUMN     "ship_height_cm" INTEGER,
ADD COLUMN     "ship_length_cm" INTEGER,
ADD COLUMN     "ship_width_cm" INTEGER;

-- AlterTable
ALTER TABLE "barter_deals" ADD COLUMN     "address_a_id" TEXT,
ADD COLUMN     "address_b_id" TEXT,
ADD COLUMN     "confirmed_a_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_b_at" TIMESTAMP(3),
ADD COLUMN     "deposit_a" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deposit_b" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Rumah',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "district_id" INTEGER NOT NULL,
    "subdistrict_id" INTEGER NOT NULL,
    "zipcode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barter_shipments" (
    "id" TEXT NOT NULL,
    "deal_id" TEXT NOT NULL,
    "leg" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "origin" JSONB NOT NULL,
    "destination" JSONB NOT NULL,
    "weight_g" INTEGER NOT NULL,
    "length_cm" INTEGER NOT NULL,
    "width_cm" INTEGER NOT NULL,
    "height_cm" INTEGER NOT NULL,
    "item_value" INTEGER NOT NULL,
    "courier" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "etd" TEXT,
    "shipping_cost" INTEGER NOT NULL,
    "insurance" INTEGER NOT NULL DEFAULT 0,
    "order_id" TEXT,
    "pickup_number" TEXT,
    "awb" TEXT,
    "status" TEXT NOT NULL DEFAULT 'quoted',
    "status_text" TEXT,
    "events" JSONB NOT NULL DEFAULT '[]',
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barter_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "user_addresses"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "barter_shipments_order_id_key" ON "barter_shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "barter_shipments_deal_id_leg_key" ON "barter_shipments"("deal_id", "leg");

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barter_shipments" ADD CONSTRAINT "barter_shipments_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "barter_deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Status deal mode Kirim.
ALTER TABLE "barter_deals" DROP CONSTRAINT "barter_deals_status_check";
ALTER TABLE "barter_deals" ADD CONSTRAINT "barter_deals_status_check"
  CHECK ("status" IN ('proposed','agreed','dikirim','diterima','done','rejected','cancelled','expired','disputed','resolved'));
ALTER TABLE "barter_shipments" ADD CONSTRAINT "barter_shipments_leg_check" CHECK ("leg" IN ('a_to_b','b_to_a'));
ALTER TABLE "barter_shipments" ADD CONSTRAINT "barter_shipments_status_check"
  CHECK ("status" IN ('quoted','paid','requested','shipped','delivered','canceled','returned','problem','failed'));
ALTER TABLE "wallet_holds" DROP CONSTRAINT "wallet_holds_kind_check";
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_kind_check" CHECK ("kind" IN ('bea','tambah','deposit','ongkir'));

-- Dimensi paket per kategori aset (cm). Sepeda ≈ dus 140×20×75 → volumetrik ±35 kg.
UPDATE "barter_categories" SET "ship_length_cm"=140, "ship_width_cm"=20, "ship_height_cm"=75 WHERE "slug"='sepeda';
UPDATE "barter_categories" SET "ship_length_cm"=20,  "ship_width_cm"=12, "ship_height_cm"=8  WHERE "slug"='hp';
UPDATE "barter_categories" SET "ship_length_cm"=45,  "ship_width_cm"=35, "ship_height_cm"=10 WHERE "slug"='laptop';
UPDATE "barter_categories" SET "ship_length_cm"=60,  "ship_width_cm"=40, "ship_height_cm"=40 WHERE "slug"='elektronik-rumah';
UPDATE "barter_categories" SET "ship_length_cm"=30,  "ship_width_cm"=22, "ship_height_cm"=8  WHERE "slug"='buku';
UPDATE "barter_categories" SET "ship_length_cm"=35,  "ship_width_cm"=25, "ship_height_cm"=12 WHERE "slug"='fashion';
UPDATE "barter_categories" SET "ship_length_cm"=30,  "ship_width_cm"=30, "ship_height_cm"=20 WHERE "slug"='lainnya';
