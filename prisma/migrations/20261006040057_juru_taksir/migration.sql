-- AlterTable
ALTER TABLE "barter_items" ADD COLUMN     "accuracy" TEXT,
ADD COLUMN     "appraisal_note" TEXT,
ADD COLUMN     "appraisal_status" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "bought_condition" TEXT,
ADD COLUMN     "is_collectible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "production_year" INTEGER,
ADD COLUMN     "research_id" TEXT,
ADD COLUMN     "valuation_method" TEXT;

-- CreateTable
CREATE TABLE "price_research" (
    "id" TEXT NOT NULL,
    "query_key" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pembanding" JSONB NOT NULL DEFAULT '[]',
    "statistik" JSONB NOT NULL DEFAULT '{}',
    "sumber_ok" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_research_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_research_query_key_key" ON "price_research"("query_key");

-- AddForeignKey
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_research_id_fkey" FOREIGN KEY ("research_id") REFERENCES "price_research"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aturan data Juru Taksir.
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_bought_condition_check" CHECK ("bought_condition" IS NULL OR "bought_condition" IN ('baru','bekas'));
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_accuracy_check" CHECK ("accuracy" IS NULL OR "accuracy" IN ('tinggi','sedang','rendah','ditera'));
ALTER TABLE "barter_items" ADD CONSTRAINT "barter_items_appraisal_status_check" CHECK ("appraisal_status" IN ('none','diminta','ditera'));
