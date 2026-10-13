// Uji Fase 4 — Balai Lelang v2 (pemenang wajib bayar, peringkat 2–3, gagal) dengan DOKU tiruan di kongsi_dev:
//   npx tsx --conditions=react-server scripts/uji/lelang.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const Lel = await import("@/lib/domain/lelang");
  const S = await import("@/lib/domain/setoran");
  const Bayar = await import("@/lib/domain/pembayaran");
  const { BIAYA_TRANSFER } = await import("@/lib/domain/tukar-aturan");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message || "galat"; } };

  const ids = ["uji-lel-p1", "uji-lel-p2", "uji-lel-p3", "uji-lel-p4", "uji-lel-pemilik", "uji-lel-admin"];
  const [P1, P2, P3, P4, OW, ADM] = ids;
  const SLUG = "uji-lelang-lapak";
  const bersih = async () => {
    const m = await prisma.merchant.findUnique({ where: { slug: SLUG }, select: { id: true } });
    await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
    if (m) {
      await prisma.auction.deleteMany({ where: { merchant_id: m.id } });
      await prisma.voucher.deleteMany({ where: { merchant_id: m.id } });
      await prisma.orderItem.deleteMany({ where: { merchant_id: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };
  await bersih();
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  await prisma.staffRole.create({ data: { user_id: ADM, role: "admin" } });
  const m = await prisma.merchant.create({
    data: {
      slug: SLUG,
      name: "Lapak Uji Lelang",
      category: "kecantikan",
      owner_id: OW,
      branches: { create: [{ name: "Cabang Lelang", address: "Jl. Lelang 1" }] },
      products: { create: [{ name: "Spa Uji", price: 100_000, kind: "evoucher", valid_days: 60 }] },
    },
    include: { branches: true, products: true },
  });
  const [cabang] = m.branches;
  const prod = m.products[0];
  const akun = (id: string) => ({ id, name: id, email: `${id}@uji.local` });
  const lelang = (id: string) => prisma.auction.findUniqueOrThrow({ where: { id }, include: { hak: { orderBy: { peringkat: "asc" } } } });
  const dasar = { productId: prod.id, type: "reguler" as const, clueCategory: "Spa relaksasi", clueNameMasked: "L••••k U••", normalPrice: 100_000, capacity: 3, facilities: ["Spa 60 menit"] };
  /** Habiskan waktu fase sampai lelang berstatus `sampai`. */
  async function majukan(id: string, sampai: string) {
    for (let i = 0; i < 8 && (await lelang(id)).status !== sampai; i++) {
      await prisma.auction.update({ where: { id }, data: { phase_ends_at: new Date(Date.now() - 1000) } });
      await Lel.advanceAuctions();
    }
  }
  const SITE = "https://kongsidagang.store";
  const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    // ---------- Pengurus membuat lelang ----------
    ok((await galat(() => Lel.buatLelang(ADM, { ...dasar, dealPrice: 80_000, setPrice: 81_000 }))).includes("Harga set minimal"), "harga set < deal + biaya transfer ditolak");
    ok((await galat(() => Lel.buatLelang(ADM, { ...dasar, normalPrice: 70_000, dealPrice: 60_000, setPrice: 80_000 }))).includes("normal"), "harga normal di bawah set ditolak");
    ok((await galat(() => Lel.buatLelang(OW, { ...dasar, dealPrice: 60_000, setPrice: 80_000 }))).includes("sendiri"), "pemilik lapak tidak bisa melelang produknya sendiri");
    const a1 = (await Lel.buatLelang(ADM, { ...dasar, dealPrice: 60_000, setPrice: 80_000 })).id;
    ok((await lelang(a1)).status === "draf", "lelang baru berstatus draf");
    ok((await galat(() => Lel.tebak(P1, a1, 70_000))).includes("tidak menerima"), "draf belum menerima tebakan");
    await Lel.mulaiLelang(ADM, a1);
    ok((await lelang(a1)).status === "kumpul", "dimulai → kumpul");

    // ---------- Peserta ----------
    ok((await galat(() => Lel.ikut(ADM, a1))).includes("Pengurus"), "pengurus tidak boleh ikut (tahu harga rahasia)");
    ok((await galat(() => Lel.ikut(OW, a1))).includes("Pemilik lapak"), "pemilik lapak tidak boleh ikut");
    await Lel.tebak(P1, a1, 70_000); // selisih 10rb (lebih awal)
    await tunggu(20);
    await Lel.tebak(P2, a1, 90_000); // selisih 10rb (lebih akhir)
    await tunggu(20);
    await Lel.tebak(P3, a1, 79_000); // selisih 1rb ...
    await tunggu(20);
    await Lel.tebak(P3, a1, 50_000); // ... tapi tebakan terakhir yang dihitung → selisih 30rb
    ok((await galat(() => Lel.ikut(P4, a1))).includes("penuh"), "kapasitas peserta ditegakkan");

    // ---------- Pemenang ----------
    await majukan(a1, "bayar");
    let l = await lelang(a1);
    ok(l.hak.map((h) => h.user_id).join() === [P1, P2, P3].join(), "peringkat: terdekat menang, seri → tebakan paling awal, tebakan terakhir dihitung");
    ok(l.hak[0].status === "menunggu" && l.hak[0].tenggat !== null && l.hak[1].status === "antri", "peringkat 1 diberi tenggat bayar");
    ok((await prisma.voucher.count({ where: { merchant_id: m.id } })) === 0, "belum ada voucher sebelum pemenang membayar");
    ok((await galat(() => Lel.batalkanLelang(ADM, a1, "dibatalkan setelah pemenang"))).includes("tidak bisa"), "tidak bisa dibatalkan setelah pemenang ditentukan");
    ok((await galat(() => Lel.mulaiBayarLelang(akun(P2), a1, cabang.id, "VIRTUAL_ACCOUNT_BRI", SITE))).includes("tidak sedang memegang"), "peringkat 2 belum bisa membayar");

    // P1 tidak bayar → hangus → P2
    await prisma.auctionHak.update({ where: { id: l.hak[0].id }, data: { tenggat: new Date(Date.now() - 1000) } });
    await Lel.advanceAuctions();
    l = await lelang(a1);
    ok(l.hak[0].status === "hangus" && l.hak[1].status === "menunggu" && l.winner_id === P2, "P1 tidak bayar → hangus, hak pindah ke P2");

    // P2 bayar → voucher terbit, lelang selesai
    const r2 = await Lel.mulaiBayarLelang(akun(P2), a1, cabang.id, "VIRTUAL_ACCOUNT_BRI", SITE);
    const o2 = await prisma.order.findUniqueOrThrow({ where: { invoice_number: r2.invoice }, include: { items: true } });
    ok(o2.subtotal === 80_000 && o2.bea > 0 && o2.items[0].titipan === 60_000, "tagihan = harga set + platform fee + biaya DOKU; titipan lapak = harga deal");
    await Bayar.prosesLunas(r2.invoice, o2.total, "VA");
    l = await lelang(a1);
    const v2 = await prisma.voucher.findMany({ where: { merchant_id: m.id, user_id: P2 } });
    ok(l.status === "selesai" && l.hak[1].status === "lunas" && l.hak[2].status === "hangus", "lunas → selesai; peringkat lain ditutup");
    ok(v2.length === 1 && v2[0].branch_id === cabang.id && v2[0].status === "aktif", "Surat Jalan lapak terbit untuk P2 di cabang pilihannya");
    ok((await S.ringkasanLapak([m.id]))[0].aktif === 60_000, "hak lapak = harga deal (margin untuk Kongsi)");
    ok((await galat(() => Lel.ikut(P4, a1))) !== "", "lelang sekali jalan (tidak berulang)");

    // ---------- Bayar terlambat & lelang gagal ----------
    const a2 = (await Lel.buatLelang(ADM, { ...dasar, dealPrice: 60_000, setPrice: 80_000 })).id;
    await Lel.mulaiLelang(ADM, a2);
    await Lel.tebak(P1, a2, 81_000);
    await majukan(a2, "bayar");
    const r1 = await Lel.mulaiBayarLelang(akun(P1), a2, cabang.id, "VIRTUAL_ACCOUNT_BRI", SITE);
    l = await lelang(a2);
    await prisma.auctionHak.update({ where: { id: l.hak[0].id }, data: { tenggat: new Date(Date.now() - 1000) } });
    await Lel.advanceAuctions();
    ok((await lelang(a2)).hak[0].status === "menunggu", "hak tidak hangus selama pembayaran masih berjalan");
    await prisma.order.update({ where: { invoice_number: r1.invoice }, data: { expires_at: new Date(Date.now() - 20 * 60_000) } });
    await Lel.advanceAuctions();
    l = await lelang(a2);
    ok(l.hak[0].status === "hangus" && l.status === "gagal", "tidak ada yang bayar → lelang gagal (tanpa kewajiban ke lapak)");
    const o1 = await prisma.order.findUniqueOrThrow({ where: { invoice_number: r1.invoice } });
    await Bayar.prosesLunas(r1.invoice, o1.total, "VA");
    const tr = await prisma.transferKeluar.findFirst({ where: { ref: r1.invoice } });
    ok((await prisma.voucher.count({ where: { user_id: P1 } })) === 0 && tr?.nominal === o1.total - o1.biaya_bayar - BIAYA_TRANSFER,
      "bayar setelah hak hangus → tanpa voucher, uang kembali dipotong biaya pembayaran & transfer");

    // ---------- Blokir ----------
    ok((await Lel.blokirLelang(P1)) !== null, "2 hak hangus dalam 30 hari → diblokir ikut lelang");
    const a3 = (await Lel.buatLelang(ADM, { ...dasar, dealPrice: 60_000, setPrice: 80_000 })).id;
    await Lel.mulaiLelang(ADM, a3);
    ok((await galat(() => Lel.ikut(P1, a3))).includes("belum bisa ikut"), "yang diblokir tidak bisa ikut");
    await Lel.batalkanLelang(ADM, a3, "uji pembatalan sebelum pemenang");
    ok((await lelang(a3)).status === "batal" && (await lelang(a3)).dibatalkan_oleh === ADM, "batal sebelum pemenang tercatat");

  } finally {
    await bersih();
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
