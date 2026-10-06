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
    const a = await P.mulaiIsiPundi(user, "pedagang", "https://kongsidagang.store");
    const o = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: a.invoice } });
    ok(o.status === "pending" && o.price === 50_000 && o.keteng === 52_000 && a.url.includes(a.invoice), "pesanan pending dibuat + URL bayar");
    ok((await bal()) === 0, "Keteng belum masuk sebelum bayar");

    ok((await notif({ order: { invoice_number: a.invoice, amount: 50000 }, transaction: { status: "SUCCESS" } }, { secret: "salah" })) === 401, "notifikasi tanda tangan salah → 401");
    ok((await notif({ order: { invoice_number: a.invoice, amount: 50000 }, transaction: { status: "SUCCESS" } }, { clientId: "BRN-LAIN" })) === 401, "Client-Id lain → 401");
    ok((await bal()) === 0, "saldo tetap 0 setelah notifikasi palsu");

    ok((await notif({ order: { invoice_number: a.invoice, amount: 5000 }, transaction: { status: "SUCCESS" } })) === 200 && (await bal()) === 0, "nominal tidak cocok → tidak dikredit");
    ok((await notif({ order: { invoice_number: a.invoice, amount: 50000 }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS" } })) === 200, "notifikasi sah → 200");
    ok((await bal()) === 52_000, "Keteng masuk 50.000 + bonus 2.000");
    await notif({ order: { invoice_number: a.invoice, amount: 50000 }, transaction: { status: "SUCCESS" } });
    ok((await bal()) === 52_000, "notifikasi ganda tidak mengkredit dua kali");
    const o2 = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: a.invoice } });
    ok(o2.status === "paid" && o2.channel === "QRIS" && !!o2.paid_at, "pesanan paid + kanal tercatat");

    const b = await P.mulaiIsiPundi(user, "eceran", "https://kongsidagang.store");
    await notif({ order: { invoice_number: b.invoice, amount: 10000 }, transaction: { status: "FAILED" } });
    ok((await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: b.invoice } })).status === "failed" && (await bal()) === 52_000, "status FAILED → pesanan gagal, saldo tetap");

    // Balapan: 5 notifikasi sukses bersamaan untuk satu invoice → kredit sekali.
    const c = await P.mulaiIsiPundi(user, "eceran", "https://kongsidagang.store");
    await Promise.all(Array.from({ length: 5 }, () => P.lunasiIsiPundi(c.invoice, 10_000, "VA").catch(() => "galat")));
    ok((await bal()) === 62_000, "5 pelunasan bersamaan → kredit sekali");

    // Semua pesanan sebelumnya sudah lunas/gagal → 3 pending baru boleh, yang ke-4 ditolak.
    for (let i = 0; i < 3; i++) await P.mulaiIsiPundi(user, "eceran", "https://x");
    const ke4 = await P.mulaiIsiPundi(user, "eceran", "https://x").then(() => "lolos", (e: Error) => e.message);
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
