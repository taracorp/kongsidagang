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
    await setSaldo(U, 0);
    const iA = await prisma.barterItem.create({ data: { user_id: U, title: "Uji A", est_value: 100_000, status: "aktif" } });
    const iB = await prisma.barterItem.create({ data: { user_id: V, title: "Uji B", est_value: 300_000, status: "aktif" } });
    items.push(iA.id, iB.id);
    const sel = hitungSelisih(100_000, 300_000);
    const ajukan = { myItemId: iA.id, targetId: iB.id, topup: sel.diff, mode: "cod", addressId: null };
    const butuh = 10_000 + sel.diff; // bea 10rb + tambah Keteng

    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_ajukan", { ...ajukan, myItemId: iB.id }, "penuh", "QRIS", SITE))).includes("barangmu"),
      "input tidak sah ditolak SEBELUM user membayar");
    ok((await prisma.topupOrder.count({ where: { user_id: U } })) === 0, "tidak ada tagihan untuk input tidak sah");
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "belanja" as never, {}, "penuh", "QRIS", SITE))).includes("Tujuan"),
      "belanja tidak bisa lewat Keteng (Keteng khusus Tukar Guling)");

    // Saldo sebagian: pilih kurang / penuh, biaya metode ditanggung pembeli
    await setSaldo(U, 100_000);
    const k1 = await L.mulaiBayarLangsung(akun(U), "tukar_ajukan", ajukan, "kurang", "QRIS", SITE);
    const o1 = await order(k1.invoice);
    ok(o1.keteng === butuh - 100_000 && o1.price === rincianBayar(o1.keteng, "QRIS").total && o1.biaya_bayar === o1.price - o1.keteng,
      `pakai saldo: beli ${o1.keteng} Keteng, bayar ${o1.price} (biaya QRIS ${o1.biaya_bayar})`);
    const k2 = await L.mulaiBayarLangsung(akun(U), "tukar_ajukan", ajukan, "penuh", "VIRTUAL_ACCOUNT_BRI", SITE);
    const o2 = await order(k2.invoice);
    ok(o2.keteng === butuh && o2.biaya_bayar >= 4_440 && o2.metode === "VIRTUAL_ACCOUNT_BRI", `bayar penuh: ${o2.keteng} Keteng + biaya VA ${o2.biaya_bayar}`);
    await prisma.topupOrder.deleteMany({ where: { invoice_number: { in: [k1.invoice, k2.invoice] } } });
    await setSaldo(U, butuh - 3_000);
    const k3 = await L.mulaiBayarLangsung(akun(U), "tukar_ajukan", ajukan, "kurang", "QRIS", SITE);
    ok((await order(k3.invoice)).keteng === 10_000, "kekurangan 3rb → minimal 10.000 Keteng");
    await prisma.topupOrder.deleteMany({ where: { invoice_number: k3.invoice } });
    await setSaldo(U, butuh + 5_000);
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "tukar_ajukan", ajukan, "kurang", "QRIS", SITE))).includes("sudah cukup"),
      "saldo cukup + 'kurang' → disuruh bayar pakai Keteng");
    await setSaldo(U, 0);

    // --- Ajukan & terima COD lewat bayar langsung
    const muatanAjukan = ajukan;
    const e = await L.mulaiBayarLangsung(akun(U), "tukar_ajukan", muatanAjukan, "penuh", "QRIS", SITE);
    const oe = await order(e.invoice);
    ok(oe.keteng === butuh && oe.price === rincianBayar(butuh, "QRIS").total, `ajukan: ${butuh} Keteng (bea 10rb + tambah ${sel.diff}) + biaya QRIS`);
    await notif(e.invoice, oe.price - 100);
    ok((await order(e.invoice)).status === "pending", "nominal tidak cocok → ditolak");
    await notif(e.invoice, oe.price);
    const o = await order(e.invoice);
    const deal = o.tujuan_ref ? await prisma.barterDeal.findUnique({ where: { id: o.tujuan_ref } }) : null;
    ok(o.tujuan_status === "berhasil" && deal?.status === "proposed" && (await bal(U)) === 0, "ajukan otomatis setelah lunas; Keteng ditahan rekber");
    ok((await galat(() => L.mulaiBayarLangsung(akun(V), "tukar_terima", { dealId: deal!.id, meetType: "minimarket", meetPlace: "ab" }, "penuh", "QRIS", SITE))) !== "",
      "terima: Titik Aman tidak sah ditolak sebelum bayar");
    const f = await L.mulaiBayarLangsung(akun(V), "tukar_terima", { dealId: deal!.id, meetType: "minimarket", meetPlace: "Indomaret Kaliurang" }, "penuh", "EMONEY_DANA", SITE);
    const of = await order(f.invoice);
    ok(of.keteng === 10_000 && of.metode === "EMONEY_DANA", "terima: 10.000 Keteng (bea) via DANA");
    await notif(f.invoice, of.price);
    await L.jalankanTujuan(f.invoice);
    ok((await prisma.barterDeal.findUniqueOrThrow({ where: { id: deal!.id } })).status === "agreed", "terima otomatis setelah lunas → deal disepakati");

    for (const id of ids) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: id }, _sum: { amount: true } }))._sum.amount ?? 0;
      const ditahan = (await prisma.walletHold.aggregate({ where: { user_id: id, status: "ditahan" }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(id)), `${id}: Σ transaksi = saldo (ditahan ${ditahan})`);
    }
  } finally {
    await prisma.barterDeal.deleteMany({ where: { OR: [{ item_a: { in: items } }, { item_b: { in: items } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
