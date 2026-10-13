-- Status paket baru (pengaman uang, Ch 8.33):
-- perlu_cek   = jawaban buatOrder hilang (order mungkin terbentuk) → dipastikan lewat pelacakan, tidak dibuat ulang
-- perlu_batal = deal batal, order di kurir diminta dibatalkan; ongkir kembali hanya bila kurir memastikan batal
-- batal_gagal = kurir menolak pembatalan (mis. sudah dijemput) → ongkir hangus menutup KA Credit
ALTER TABLE "barter_shipments" DROP CONSTRAINT "barter_shipments_status_check";
ALTER TABLE "barter_shipments" ADD CONSTRAINT "barter_shipments_status_check"
  CHECK ("status" IN ('quoted','paid','requested','shipped','delivered','canceled','returned','problem','failed','perlu_cek','perlu_batal','batal_gagal'));
