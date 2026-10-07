-- Isi Pundi tanpa bonus: pembeli membayar Keteng + biaya DOKU, jadi price ≥ keteng (dulu keteng ≥ price karena bonus).
ALTER TABLE "topup_orders" DROP CONSTRAINT "topup_orders_amount_pos";
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_amount_pos" CHECK ("price" > 0 AND "keteng" > 0);
