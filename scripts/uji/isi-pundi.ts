// Uji Isi Pundi DOKU (driver tiruan + route notifikasi) di kongsi_dev:
//   npx tsx --conditions=react-server scripts/uji/isi-pundi.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";
process.env.DOKU_CLIENT_ID = "BRN-UJI-0001";
process.env.DOKU_SECRET_KEY = "SK-rahasia-uji";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const { rincianBayar } = await import("@/lib/payment/biaya");
  const D = await import("@/lib/payment/doku");
  const { POST } = await import("@/app/api/doku/notifikasi/route");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const U = "uji-isi-pundi";
  await prisma.user.deleteMany({ where: { id: U } });
  await prisma.user.create({ data: { id: U, name: "Uji Isi", email: `${U}@uji.local` } });
  const bal = async () => (await prisma.wallet.findUnique({ where: { user_id: U } }))?.balance ?? 0;
  const user = { id: U, name: "Uji Isi", email: `${U}@uji.local` };

  async function notif(body: object, opts: { secret?: string; clientId?: string } = {}) {
    const raw = JSON.stringify(body);
    const clientId = opts.clientId ?? "BRN-UJI-0001";
    const h = { clientId, requestId: crypto.randomUUID(), timestamp: D.stempelWaktu(), target: D.PATH_NOTIFIKASI };
    const res = await POST(new Request("http://x" + D.PATH_NOTIFIKASI, {
      method: "POST",
      headers: { "client-id": clientId, "request-id": h.requestId, "request-timestamp": h.timestamp, signature: D.tandaTangan(opts.secret ?? "SK-rahasia-uji", h, raw) },
      body: raw,
    }));
    return res.status;
  }

  try {
    ok(P.isiPundiTersedia() === "doku", "mode Isi Pundi = doku (driver tiruan)");
    const a = await P.mulaiIsiPundi(user, "50000", "QRIS", "https://kongsidagang.store");
    const o = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: a.invoice } });
    const T = o.price; // 50.000 + biaya QRIS
    ok(o.status === "pending" && o.keteng === 50_000 && T === rincianBayar(50_000, "QRIS").total && o.biaya_bayar === T - 50_000 && a.url.includes(a.invoice),
      `pesanan pending: 50.000 Keteng, bayar ${T} (biaya QRIS ${o.biaya_bayar}, tanpa bonus)`);
    ok((await bal()) === 0, "Keteng belum masuk sebelum bayar");

    ok((await notif({ order: { invoice_number: a.invoice, amount: T }, transaction: { status: "SUCCESS" } }, { secret: "salah" })) === 401, "notifikasi tanda tangan salah → 401");
    ok((await notif({ order: { invoice_number: a.invoice, amount: T }, transaction: { status: "SUCCESS" } }, { clientId: "BRN-LAIN" })) === 401, "Client-Id lain → 401");
    ok((await bal()) === 0, "saldo tetap 0 setelah notifikasi palsu");

    ok((await notif({ order: { invoice_number: a.invoice, amount: 50000 }, transaction: { status: "SUCCESS" } })) === 200 && (await bal()) === 0, "nominal tanpa biaya (tidak cocok) → tidak dikredit");
    ok((await notif({ order: { invoice_number: a.invoice, amount: T }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS" } })) === 200, "notifikasi sah → 200");
    ok((await bal()) === 50_000, "Keteng masuk tepat 50.000 (biaya pembayaran tidak jadi Keteng)");
    await notif({ order: { invoice_number: a.invoice, amount: T }, transaction: { status: "SUCCESS" } });
    ok((await bal()) === 50_000, "notifikasi ganda tidak mengkredit dua kali");
    const o2 = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: a.invoice } });
    ok(o2.status === "paid" && o2.channel === "QRIS" && !!o2.paid_at, "pesanan paid + kanal tercatat");

    const b = await P.mulaiIsiPundi(user, "10000", "VIRTUAL_ACCOUNT_BCA", "https://kongsidagang.store");
    const ob0 = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: b.invoice } });
    ok(ob0.biaya_bayar >= 4_995 && ob0.metode === "VIRTUAL_ACCOUNT_BCA", `VA BCA: Isi 10rb bayar ${ob0.price} (biaya ${ob0.biaya_bayar} ditanggung pembeli)`);
    await notif({ order: { invoice_number: b.invoice, amount: ob0.price }, transaction: { status: "FAILED" } });
    ok((await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: b.invoice } })).status === "failed" && (await bal()) === 50_000, "status FAILED → pesanan gagal, saldo tetap");

    // Balapan: 5 notifikasi sukses bersamaan untuk satu invoice → kredit sekali.
    const c = await P.mulaiIsiPundi(user, "10000", "QRIS", "https://kongsidagang.store");
    const pc = (await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: c.invoice } })).price;
    await Promise.all(Array.from({ length: 5 }, () => P.lunasiIsiPundi(c.invoice, pc, "VA").catch(() => "galat")));
    ok((await bal()) === 60_000, "5 pelunasan bersamaan → kredit sekali");

    // Nominal bebas (mis. menutup selisih tukar 1,5jt): tanpa bonus, nominal wajib cocok.
    const nb = await P.mulaiIsiPundi(user, "1500000", "QRIS", "https://kongsidagang.store");
    const ob = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: nb.invoice } });
    ok(ob.package_id === "nominal" && ob.keteng === 1_500_000 && ob.price === rincianBayar(1_500_000, "QRIS").total, "pesanan nominal bebas 1,5jt dibuat");
    const sebelum = await bal();
    await notif({ order: { invoice_number: nb.invoice, amount: ob.price }, transaction: { status: "SUCCESS" } });
    ok((await bal()) === sebelum + 1_500_000, "nominal 1,5jt masuk tepat (tanpa bonus)");

    // Semua pesanan sebelumnya sudah lunas/gagal → 3 pending baru boleh, yang ke-4 ditolak.
    for (let i = 0; i < 3; i++) await P.mulaiIsiPundi(user, "10000", "QRIS", "https://x");
    const ke4 = await P.mulaiIsiPundi(user, "10000", "QRIS", "https://x").then(() => "lolos", (e: Error) => e.message);
    ok(ke4.includes("menunggu"), "maks 3 pesanan pending per jam (ke-4 ditolak)");

    const sTx = (await prisma.walletTransaction.aggregate({ where: { user_id: U }, _sum: { amount: true } }))._sum.amount ?? 0;
    ok(sTx === (await bal()), "Σ transaksi = saldo");
  } finally {
    await prisma.user.deleteMany({ where: { id: U } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
