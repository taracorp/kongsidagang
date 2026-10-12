-- AlterTable
ALTER TABLE "barter_items" ADD COLUMN     "want_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

