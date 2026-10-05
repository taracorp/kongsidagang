-- CreateTable
CREATE TABLE "wallet_holds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deal_id" TEXT,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ditahan',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "wallet_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_holds_user_id_status_idx" ON "wallet_holds"("user_id", "status");

-- CreateIndex
CREATE INDEX "wallet_holds_deal_id_idx" ON "wallet_holds"("deal_id");

-- AddForeignKey
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aturan rekber.
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_amount_pos" CHECK ("amount" > 0);
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_kind_check" CHECK ("kind" IN ('bea','tambah','deposit','ongkir'));
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_status_check" CHECK ("status" IN ('ditahan','diambil','dilepas','dikembalikan'));
