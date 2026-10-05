-- AlterTable
ALTER TABLE "barter_items" ADD COLUMN     "category" TEXT,
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "est_high" INTEGER,
ADD COLUMN     "est_low" INTEGER,
ADD COLUMN     "purchase_price" INTEGER,
ADD COLUMN     "purchase_year" INTEGER,
ADD COLUMN     "qty" DOUBLE PRECISION,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "ship_weight_kg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "barter_categories" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "unit" TEXT,
    "rate_y1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate_next" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floor_pct" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "ship_weight_kg" DOUBLE PRECISION NOT NULL,
    "needs_serial" BOOLEAN NOT NULL DEFAULT false,
    "serial_label" TEXT,
    "checklist" JSONB NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "barter_categories_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "commodity_prices" (
    "id" TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "price_per_unit" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodity_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commodity_prices_category_slug_created_at_idx" ON "commodity_prices"("category_slug", "created_at" DESC);

-- CreateIndex
CREATE INDEX "barter_items_serial_number_idx" ON "barter_items"("serial_number");

-- AddForeignKey
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_category_fkey" FOREIGN KEY ("category") REFERENCES "barter_categories"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commodity_prices" ADD CONSTRAINT "commodity_prices_category_slug_fkey" FOREIGN KEY ("category_slug") REFERENCES "barter_categories"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan data taksiran.
ALTER TABLE "barter_categories" ADD CONSTRAINT "barter_categories_kind_check" CHECK ("kind" IN ('komoditas','aset'));
ALTER TABLE "commodity_prices" ADD CONSTRAINT "commodity_prices_pos" CHECK ("price_per_unit" > 0);

-- Kategori awal (angka susut & checklist bisa diubah Tara lewat migrasi/admin berikutnya).
INSERT INTO "barter_categories" ("slug","name","kind","unit","rate_y1","rate_next","floor_pct","ship_weight_kg","needs_serial","serial_label","checklist","sort") VALUES
  ('beras', 'Beras', 'komoditas', 'kg', 0, 0, 0, 1, false, NULL, '[{"key": "kutu", "q": "Ada kutu / bau apek?", "penalty": 0.4}, {"key": "kemasan", "q": "Kemasan sobek / rusak?", "penalty": 0.1}, {"key": "lama", "q": "Disimpan lebih dari 6 bulan?", "penalty": 0.15}]'::jsonb, 10),
  ('gula', 'Gula pasir', 'komoditas', 'kg', 0, 0, 0, 1, false, NULL, '[{"key": "basah", "q": "Menggumpal / basah?", "penalty": 0.2}, {"key": "kemasan", "q": "Kemasan sobek / rusak?", "penalty": 0.1}]'::jsonb, 11),
  ('minyak-goreng', 'Minyak goreng', 'komoditas', 'liter', 0, 0, 0, 0.9, false, NULL, '[{"key": "bocor", "q": "Kemasan bocor / penyok?", "penalty": 0.3}, {"key": "kedaluwarsa", "q": "Kurang dari 3 bulan dari kedaluwarsa?", "penalty": 0.2}]'::jsonb, 12),
  ('sepeda', 'Sepeda', 'aset', NULL, 0.2, 0.15, 0.2, 15, true, 'Nomor rangka', '[{"key": "rangka", "q": "Rangka retak / pernah dilas?", "penalty": 0.4}, {"key": "servis", "q": "Rem / gir / rantai perlu servis?", "penalty": 0.1}, {"key": "ban", "q": "Ban perlu diganti?", "penalty": 0.05}, {"key": "karat", "q": "Ada karat di rangka?", "penalty": 0.1}, {"key": "part", "q": "Ada suku cadang diganti non-ori?", "penalty": 0.1}, {"key": "gores", "q": "Ada goresan lebih dari 2 cm?", "penalty": 0.05}]'::jsonb, 20),
  ('hp', 'Ponsel', 'aset', NULL, 0.3, 0.2, 0.1, 0.5, true, 'IMEI', '[{"key": "layar", "q": "Layar retak / bergaris?", "penalty": 0.3}, {"key": "baterai", "q": "Kesehatan baterai di bawah 80%?", "penalty": 0.1}, {"key": "fungsi", "q": "Ada fungsi mati (kamera, speaker, sinyal)?", "penalty": 0.3}, {"key": "servis", "q": "Pernah servis / ganti part?", "penalty": 0.1}, {"key": "gores", "q": "Ada goresan lebih dari 2 cm di bodi?", "penalty": 0.05}, {"key": "kelengkapan", "q": "Tanpa dus / charger?", "penalty": 0.05}]'::jsonb, 21),
  ('laptop', 'Laptop', 'aset', NULL, 0.25, 0.18, 0.1, 3, true, 'Nomor seri (SN)', '[{"key": "layar", "q": "Layar ada dead pixel / garis?", "penalty": 0.25}, {"key": "baterai", "q": "Baterai cepat habis (di bawah 2 jam)?", "penalty": 0.1}, {"key": "keyboard", "q": "Ada tombol / touchpad mati?", "penalty": 0.1}, {"key": "servis", "q": "Pernah servis mesin?", "penalty": 0.1}, {"key": "gores", "q": "Ada goresan lebih dari 2 cm?", "penalty": 0.05}, {"key": "charger", "q": "Tanpa charger?", "penalty": 0.08}]'::jsonb, 22),
  ('elektronik-rumah', 'Elektronik rumah', 'aset', NULL, 0.25, 0.15, 0.1, 8, true, 'Nomor seri (SN)', '[{"key": "mati", "q": "Ada fungsi tidak bekerja?", "penalty": 0.4}, {"key": "servis", "q": "Pernah servis?", "penalty": 0.1}, {"key": "penyok", "q": "Bodi penyok / pecah?", "penalty": 0.15}, {"key": "kelengkapan", "q": "Tanpa remote / aksesori?", "penalty": 0.05}]'::jsonb, 23),
  ('buku', 'Buku', 'aset', NULL, 0.4, 0.1, 0.15, 0.5, false, NULL, '[{"key": "sobek", "q": "Halaman sobek / hilang?", "penalty": 0.3}, {"key": "coretan", "q": "Ada coretan / stabilo?", "penalty": 0.1}, {"key": "sampul", "q": "Sampul rusak?", "penalty": 0.1}, {"key": "jamur", "q": "Kertas menguning / berjamur?", "penalty": 0.15}]'::jsonb, 30),
  ('fashion', 'Pakaian & sepatu', 'aset', NULL, 0.4, 0.2, 0.1, 1, false, NULL, '[{"key": "noda", "q": "Ada noda / robek?", "penalty": 0.3}, {"key": "pudar", "q": "Warna pudar?", "penalty": 0.1}, {"key": "jahitan", "q": "Sol / jahitan lepas?", "penalty": 0.2}, {"key": "label", "q": "Tanpa label / dus?", "penalty": 0.05}]'::jsonb, 31),
  ('lainnya', 'Lainnya', 'aset', NULL, 0.3, 0.15, 0.1, 2, false, NULL, '[{"key": "rusak", "q": "Ada bagian rusak / tidak berfungsi?", "penalty": 0.3}, {"key": "gores", "q": "Ada goresan / cacat terlihat?", "penalty": 0.1}, {"key": "kelengkapan", "q": "Kelengkapan tidak lengkap?", "penalty": 0.1}]'::jsonb, 99)
ON CONFLICT ("slug") DO NOTHING;

-- Harga komoditas awal (per satuan, Okt 2026, kisaran pasar umum).
INSERT INTO "commodity_prices" ("id","category_slug","price_per_unit","source","note") VALUES
  (gen_random_uuid()::text, 'beras', 15000, 'admin', 'harga awal'),
  (gen_random_uuid()::text, 'gula', 18000, 'admin', 'harga awal'),
  (gen_random_uuid()::text, 'minyak-goreng', 20000, 'admin', 'harga awal');
