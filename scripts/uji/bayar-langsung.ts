// Uji Bayar Langsung (DOKU tiruan + route notifikasi) di kongsi_dev, data tenant asli:
//   npx tsx --conditions=react-server scripts/uji/bayar-langsung.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";
process.env.DOKU_CLIENT_ID = "BRN-UJI-0001";
process.env.DOKU_SECRET_KEY = "SK-rahasia-uji";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const L = await import("@/lib/domain/bayar-langsung");
  const D = await import("@/lib/payment/doku");
  const { hitungSelisih } = await import("@/lib/domain/tukar-aturan");
  const { POST } = await import("@/app/api/doku/notifikasi/route");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

  const U = "uji-langsung-a", V = "uji-langsung-b";
  const ids = [U, V];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const akun = (id: string) => ({ id, name: id, email: `${id}@uji.local` });
  const bal = async (id: string) => (await prisma.wallet.findUnique({ where: { user_id: id } }))?.balance ?? 0;
  const setSaldo = async (id: string, n: number) => {
    const b = await bal(id);
    if (n === b) return;
    await prisma.$transaction((tx) => (n > b ? P.credit(tx, id, n - b, "isi", "uji") : P.debit(tx, id, b - n, "isi", "uji")));
  };
  const order = (inv: string) => prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: inv } });
  async function notif(inv: string, amount: number) {
    const raw = JSON.stringify({ order: { invoice_number: inv, amount }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS" } });
    const h = { clientId: "BRN-UJI-0001", requestId: crypto.randomUUID(), timestamp: D.stempelWaktu(), target: D.PATH_NOTIFIKASI };
    const res = await POST(new Request("http://x" + D.PATH_NOTIFIKASI, {
      method: "POST",
      headers: { "client-id": h.clientId, "request-id": h.requestId, "request-timestamp": h.timestamp, signature: D.tandaTangan("SK-rahasia-uji", h, raw) },
      body: raw,
    }));
    return res.status;
  }
  const SITE = "https://kongsidagang.store";

  const { rincianBayar } = await import("@/lib/payment/biaya");
  const items: string[] = [];

  try {
    const T = await import("@/lib/domain/tukar");
    const Rek = await import("@/lib/domain/rekening");
    await setSaldo(U, 0);
    await setSaldo(V, 0);
    for (const id of ids) await Rek.simpanRekening(id, { bank: "BRI", nomor: "0011223344", atas_nama: `Pemilik ${id}` });
    const iA = await prisma.barterItem.create({ data: { user_id: U, title: "Uji A", est_value: 200_000, status: "aktif" } });
    const iB = await prisma.barterItem.create({ data: { user_id: V, title: "Uji B", est_value: 250_000, status: "aktif" } });
    items.push(iA.id, iB.id);
    const sel = hitungSelisih(200_000, 250_000);
    const dealId = await T.ajukan(U, iA.id, iB.id, sel.diff); // mengajukan gratis
    const meet = { dealId, meetType: "minimarket", meetPlace: "Indomaret Kaliurang" };

    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_ajukan", {}, "penuh", "QRIS", SITE))).includes("Tujuan"),
      "mengajukan tidak lagi berbayar (tujuan lama ditolak)");
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "belanja" as never, {}, "penuh", "QRIS", SITE))).includes("Tujuan"),
      "belanja tidak bisa lewat Keteng (Keteng khusus Tukar Guling)");
    ok((await galat(() => L.mulaiBayarLangsung(akun(V), "tukar_terima", { ...meet, meetPlace: "ab" }, "penuh", "QRIS", SITE))) !== "",
      "terima: Titik Aman tidak sah ditolak SEBELUM user membayar");
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "penuh", "QRIS", SITE))) !== "",
      "setor sebelum tawaran diterima ditolak");
    ok((await prisma.topupOrder.count({ where: { user_id: { in: ids } } })) === 0, "tidak ada tagihan untuk input tidak sah");

    // --- Terima lewat Bayar Langsung (jaminan Keteng B: bea + cadangan)
    const f = await L.mulaiBayarLangsung(akun(V), "tukar_terima", meet, "penuh", "EMONEY_DANA", SITE);
    const of = await order(f.invoice);
    ok(of.rekber === 0 && of.keteng >= 10_000 && of.metode === "EMONEY_DANA", `terima: ${of.keteng} Keteng jaminan via DANA (tanpa uang rekber)`);
    await notif(f.invoice, of.price);
    let d = await prisma.barterDeal.findUniqueOrThrow({ where: { id: dealId } });
    ok((await order(f.invoice)).tujuan_status === "berhasil" && d.status === "menunggu_bayar", "terima otomatis setelah lunas → menunggu pembayaran A");

    // --- Setor A: selisih UANG + kekurangan jaminan Keteng dalam satu tagihan
    await setSaldo(U, 4_000);
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "kurang", "EMONEY_DANA", SITE))).includes("QRIS atau Virtual Account"),
      "selisih tidak bisa lewat e-wallet");
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "kurang", "CREDIT_CARD", SITE))) !== "", "selisih tidak bisa lewat kartu");
    const k1 = await L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "kurang", "VIRTUAL_ACCOUNT_BRI", SITE);
    const o1 = await order(k1.invoice);
    const rekber = sel.diff + 2_500;
    ok(o1.keteng === 6_000 && o1.rekber === rekber && o1.price === rincianBayar(6_000 + rekber, "VIRTUAL_ACCOUNT_BRI").total,
      `pakai saldo 4rb: beli 6.000 Keteng + rekber ${rekber} (uang) + biaya VA ${o1.biaya_bayar}`);
    const k1b = await L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "kurang", "VIRTUAL_ACCOUNT_BRI", SITE);
    ok(k1b.invoice === k1.invoice, "klik ulang aksi yang sama → tagihan yang sama dipakai lagi (bukan tagihan baru)");
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_setor", { dealId }, "penuh", "QRIS", SITE))).includes("menunggu"),
      "tagihan lain untuk aksi yang sama ditolak selama tagihan pertama menunggu");
    ok((await galat(() => P.mulaiIsiPundi(akun(U), "50000", "CREDIT_CARD", SITE))).includes("Kartu"), "kartu kredit ditolak untuk Keteng (Isi Pundi)");
    ok(o1.expires_at.getTime() <= d.expires_at!.getTime(), "tagihan kedaluwarsa sebelum tenggat tukar");

    await notif(k1.invoice, o1.price - 100);
    ok((await order(k1.invoice)).status === "pending", "nominal tidak cocok → ditolak");
    ok((await prisma.pembayaranBermasalah.count({ where: { invoice: k1.invoice, jenis: "nominal_tidak_cocok" } })) === 1, "nominal tidak cocok dicatat sebagai pembayaran bermasalah");
    await notif(k1.invoice, o1.price - 100);
    ok((await prisma.pembayaranBermasalah.count({ where: { invoice: k1.invoice } })) === 1, "notifikasi ulang tidak mencatat dobel");
    await notif(k1.invoice, o1.price);
    d = await prisma.barterDeal.findUniqueOrThrow({ where: { id: dealId } });
    ok((await order(k1.invoice)).tujuan_status === "berhasil" && d.status === "agreed" && d.selisih_status === "ditahan",
      "lunas → sepakat; selisih ditahan sebagai uang");
    ok((await bal(U)) === 0, "Keteng A (saldo 4rb + 6rb dibeli) ditahan seluruhnya sebagai bea");
    await notif(k1.invoice, o1.price);
    ok((await prisma.walletTransaction.count({ where: { user_id: U, note: { startsWith: "Bayar langsung" } } })) === 1, "notifikasi lunas ganda tidak mengkredit dua kali");

    for (const id of ids) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: id }, _sum: { amount: true } }))._sum.amount ?? 0;
      const ditahan = (await prisma.walletHold.aggregate({ where: { user_id: id, status: "ditahan" }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(id)), `${id}: Σ transaksi = saldo (ditahan ${ditahan})`);
    }
  } finally {
    const inv = (await prisma.topupOrder.findMany({ where: { user_id: { in: ids } }, select: { invoice_number: true } })).map((o) => o.invoice_number);
    await prisma.pembayaranBermasalah.deleteMany({ where: { invoice: { in: inv } } });
    await prisma.notification.deleteMany({ where: { title: { in: inv.map((i) => `Pembayaran bermasalah: ${i}`) } } });
    await prisma.barterDeal.deleteMany({ where: { OR: [{ item_a: { in: items } }, { item_b: { in: items } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
