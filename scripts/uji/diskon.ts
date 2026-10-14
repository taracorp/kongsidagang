// Uji Fase diskon (Ch 8.44): lapak+Kongsi, kuota/anggaran, pembeli baru, kode, min belanja, refund, lelang bebas.
//   npx tsx --conditions=react-server scripts/uji/diskon.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const B = await import("@/lib/domain/belanja");
  const D = await import("@/lib/domain/diskon");
  const S = await import("@/lib/domain/setoran");
  const Bayar = await import("@/lib/domain/pembayaran");
  const { PLATFORM_FEE } = await import("@/lib/payment/biaya");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };


  const ids = ["uji-disk-beli", "uji-disk-beli2", "uji-disk-own", "uji-disk-admin"];
  const [U, U2, OW, ADM] = ids;
  const SLUG = "uji-diskon-lapak";
  const bersih = async () => {
    const m = await prisma.merchant.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (m) {
      await prisma.pemakaianDiskon.deleteMany({ where: { diskon: { merchant_id: m.id } } });
      await prisma.diskonKlaim.deleteMany({ where: { diskon: { OR: [{ merchant_id: m.id }, { pembuat: "platform" }] } } });
      await prisma.diskon.deleteMany({ where: { OR: [{ merchant_id: m.id }, { dibuat_oleh: { in: ids } }] } });
      await prisma.auctionHak.deleteMany({ where: { auction: { merchant_id: m.id } } });
      await prisma.auction.deleteMany({ where: { merchant_id: m.id } });
      await prisma.voucher.deleteMany({ where: { merchant_id: m.id } });
      await prisma.orderItem.deleteMany({ where: { merchant_id: m.id } });
      await prisma.order.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.potonganLapak.deleteMany({ where: { merchant_id: m.id } });
      await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };
  await bersih();
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const m = await prisma.merchant.create({
    data: { slug: SLUG, name: "Lapak Diskon Uji", category: "kecantikan", owner_id: OW, rek_bank: "BCA", rek_nomor: "1234567890", rek_atas_nama: "Lapak",
      branches: { create: [{ name: "Cabang", address: "Jl" }] }, products: { create: [{ name: "Facial", price: 100_000, kind: "evoucher", valid_days: 90 }] } },
    include: { branches: true, products: true },
  });
  const [cab] = m.branches;
  const prod = m.products[0];
  const akun = (id: string) => ({ id, name: id, email: `${id}@uji.local` });
  const beli = async (uid: string, qty: number, kode?: string) => {
    const r = await B.mulaiBelanja(akun(uid), [{ productId: prod.id, branchId: cab.id, qty }], "VIRTUAL_ACCOUNT_BRI", "https://kongsidagang.store", kode ?? null);
    return prisma.order.findUniqueOrThrow({ where: { invoice_number: r.invoice }, include: { items: true } });
  };
  const lunas = async (inv: string) => { const o = await prisma.order.findUniqueOrThrow({ where: { invoice_number: inv } }); await Bayar.prosesLunas(inv, o.total, "VA"); };
  // Bersihkan pesanan "menunggu" (mencegah batas 3 pending/jam) — melepas diskon yang dicadangkan.
  const sikat = async () => { for (const id of ids) for (const o of await prisma.order.findMany({ where: { user_id: id, status: "menunggu" }, select: { invoice_number: true } })) await B.gagalkanBelanja(o.invoice_number!, "kedaluwarsa"); };

  try {
    // ---------- Diskon lapak persen dengan batas ----------
    const dL = await D.buatDiskonLapak(OW, m.id, { nama: "Diskon 20%", jenis: "persen", nilai: 20, maks_potongan: 30_000 });
    let o = await beli(U, 1);
    ok(o.diskon_lapak === 20_000 && o.diskon_platform === 0 && o.total === 100_000 - 20_000 + PLATFORM_FEE + o.biaya_bayar, "diskon lapak 20% (20rb) mengurangi total");
    ok(o.items[0].titipan === 80_000 && o.items[0].diskon_lapak_unit === 20_000, "titipan lapak berkurang jadi 80rb");
    o = await beli(U, 3); // 300rb × 20% = 60rb → dibatasi 30rb
    ok(o.diskon_lapak === 30_000, "maks potongan 30rb ditegakkan");
    await lunas(o.invoice_number!);
    ok((await S.ringkasanLapak([m.id]))[0].aktif === 270_000, "setoran lapak berkurang sesuai diskon (cap 30rb → 3×90rb)");

    await sikat();
    // ---------- Diskon Kongsi potongan + gabung 1 lapak + 1 Kongsi ----------
    const dP = await D.buatDiskonPlatform(ADM, { nama: "Potongan Kongsi 15rb", jenis: "potongan", nilai: 15_000, anggaran: 100_000 });
    o = await beli(U2, 1);
    ok(o.diskon_lapak === 20_000 && o.diskon_platform === 15_000, "pesanan memakai 1 diskon lapak + 1 diskon Kongsi");
    ok(o.items[0].titipan === 80_000, "diskon Kongsi tidak mengurangi titipan lapak");
    ok(o.total === 100_000 - 35_000 + PLATFORM_FEE + o.biaya_bayar, "total = harga − diskon lapak − diskon Kongsi + fee + biaya");

    await sikat();
    // ---------- Anggaran Kongsi habis → berhenti otomatis ----------
    await prisma.diskon.update({ where: { id: dP.id }, data: { terpakai_rupiah: 95_000 } }); // sisa 5rb
    o = await beli(U, 1);
    ok(o.diskon_platform === 5_000, "diskon Kongsi dibatasi sisa anggaran (5rb)");
    await prisma.diskon.update({ where: { id: dP.id }, data: { terpakai_rupiah: 100_000 } });
    o = await beli(U, 1);
    ok(o.diskon_platform === 0, "anggaran habis → diskon Kongsi berhenti otomatis");

    await sikat();
    // ---------- Kuota per user ----------
    await D.aturDiskonAktif(dP.id, false);
    const _dK = await D.buatDiskonLapak(OW, m.id, { nama: "Sekali pakai", jenis: "potongan", nilai: 10_000, kuota_per_user: 1, kode: "SEKALI" });
    await D.aturDiskonAktif(dL.id, false); // matikan diskon lapak lain agar SEKALI yang dipakai
    await D.klaimDiskon(U, "SEKALI"); void _dK;
    const o1 = await beli(U, 1);
    ok(o1.diskon_lapak === 10_000, "kode SEKALI dipakai (setelah diklaim)");
    await lunas(o1.invoice_number!);
    const o2 = await beli(U, 1, "SEKALI");
    ok(o2.diskon_lapak === 0, "kuota per user habis → tidak dipakai lagi");
    ok((await beli(U2, 1)).diskon_lapak === 0, "diskon berkode tidak dipakai tanpa klaim/kode");
    ok((await beli(U2, 1, "SEKALI")).diskon_lapak === 10_000, "kode diketik langsung di checkout juga berlaku");

    await sikat();
    // ---------- Pembeli baru ----------
    await prisma.diskon.updateMany({ where: { merchant_id: m.id }, data: { aktif: false } });
    const dB = await D.buatDiskonLapak(OW, m.id, { nama: "Member baru", jenis: "persen", nilai: 50, hanya_pembeli_baru: true });
    ok((await beli(U, 1)).diskon_lapak === 0, "U sudah pernah belanja lunas → bukan pembeli baru");
    ok((await beli(OW, 1)).diskon_lapak === 50_000, "pembeli baru dapat 50% (OW belum pernah belanja)");

    await sikat();
    // ---------- Min belanja ----------
    await prisma.diskon.updateMany({ where: { merchant_id: m.id }, data: { aktif: false } });
    const dM = await D.buatDiskonLapak(OW, m.id, { nama: "Min 200rb", jenis: "potongan", nilai: 25_000, min_belanja: 200_000 });
    ok((await beli(U, 1)).diskon_lapak === 0, "di bawah min belanja → tidak berlaku");
    ok((await beli(U, 2)).diskon_lapak === 25_000, "memenuhi min belanja → berlaku");

    await sikat();
    // ---------- Pelepasan saat gagal (kuota kembali) ----------
    await prisma.diskon.updateMany({ where: { merchant_id: m.id }, data: { aktif: false } });
    const dKuota = await D.buatDiskonLapak(OW, m.id, { nama: "Kuota 1", jenis: "potongan", nilai: 10_000, kuota_total: 1, kuota_per_user: 5 });
    const og = await beli(U, 2);
    ok(og.diskon_lapak === 10_000 && (await prisma.diskon.findUniqueOrThrow({ where: { id: dKuota.id } })).terpakai_count === 1, "pemakaian dicadangkan");
    await B.gagalkanBelanja(og.invoice_number!, "kedaluwarsa");
    ok((await prisma.diskon.findUniqueOrThrow({ where: { id: dKuota.id } })).terpakai_count === 0, "gagal → kuota dilepas kembali");
    const og2 = await beli(U2, 2);
    ok(og2.diskon_lapak === 10_000, "kuota bisa dipakai lagi setelah dilepas");

    await sikat();
    // ---------- Refund memperhitungkan diskon ----------
    await prisma.diskon.updateMany({ where: { merchant_id: m.id }, data: { aktif: false } });
    const dR = await D.buatDiskonLapak(OW, m.id, { nama: "R 30rb", jenis: "potongan", nilai: 30_000 });
    const or = await beli(U, 1);
    await lunas(or.invoice_number!);
    const vr = await prisma.voucher.findFirstOrThrow({ where: { order_item_id: or.items[0].id } });
    const r = await S.kembalikanVoucher(ADM, vr.code!, "Cabang tutup permanen uji");
    ok(r.nominal === (100_000 - 30_000) + Math.round(or.bea) + Math.round(or.biaya_bayar), `pembeli dikembalikan ${r.nominal} = harga setelah diskon + fee + DOKU`);
    void dB; void dM; void dR;

    await sikat();
    // ---------- Lelang bebas diskon ----------
    const aId = (await prisma.auction.create({ data: { type: "reguler", clue_category: "x", clue_name_masked: "x", normal_price: 100_000, deal_price: 60_000, set_price: 80_000, status: "bayar", merchant_id: m.id, product_id: prod.id } })).id;
    await prisma.auctionHak.create({ data: { auction_id: aId, user_id: U, peringkat: 1, guess: 80_000, status: "menunggu", tenggat: new Date(Date.now() + 3600_000) } });
    await prisma.diskon.updateMany({ where: { merchant_id: m.id }, data: { aktif: true } }); // aktifkan semua
    const Lel = await import("@/lib/domain/lelang");
    const rl = await Lel.mulaiBayarLelang(akun(U), aId, cab.id, "VIRTUAL_ACCOUNT_BRI", "https://kongsidagang.store");
    const ol = await prisma.order.findUniqueOrThrow({ where: { invoice_number: rl.invoice } });
    ok(ol.diskon_lapak === 0 && ol.diskon_platform === 0 && ol.subtotal === 80_000, "pembayaran lelang tidak kena diskon");
  } finally {
    await bersih();
    await prisma.auction.deleteMany({ where: { clue_category: "x", clue_name_masked: "x" } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
