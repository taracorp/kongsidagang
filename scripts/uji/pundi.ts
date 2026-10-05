// Uji ledger Pundi di kongsi_dev: npx tsx --conditions=react-server scripts/uji/pundi.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.ENABLE_TOPUP_DEMO = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const ok = (c: boolean, m: string) => {
    if (!c) throw new Error("GAGAL: " + m);
    console.log("✓", m);
  };
  const ids = ["uji-pundi-a", "uji-pundi-b"];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids)
    await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const [A, B] = ids;
  const bal = async (u: string) => (await prisma.wallet.findUnique({ where: { user_id: u } }))?.balance ?? 0;
  const sumTx = async (u: string) =>
    (await prisma.walletTransaction.aggregate({ where: { user_id: u }, _sum: { amount: true } }))._sum.amount ?? 0;

  try {
    ok((await P.topupDemo(A, "pedagang")) === 52_000, "paket Pedagang → 52.000 Keteng (bonus 2rb)");
    await P.topupDemo(B, "eceran");

    const h = await prisma.$transaction((tx) => P.hold(tx, A, null, 10_000, "bea", "uji bea"));
    const t = await prisma.$transaction((tx) => P.hold(tx, A, null, 5_000, "tambah", "uji tambah"));
    const d = await prisma.$transaction((tx) => P.hold(tx, A, null, 3_000, "deposit", "uji deposit"));
    ok((await bal(A)) === 34_000, "3 hold memotong saldo A → 34.000");

    await prisma.$transaction((tx) => P.captureHold(tx, h.id));
    await prisma.$transaction((tx) => P.releaseHold(tx, t.id, B, "uji terima"));
    await prisma.$transaction((tx) => P.refundHold(tx, d.id, "uji kembali"));
    ok((await bal(A)) === 37_000, "deposit kembali → A 37.000 (bea diambil, tambah pindah)");
    ok((await bal(B)) === 15_000, "B menerima tambah 5.000 → 15.000");

    let dbl = false;
    try { await prisma.$transaction((tx) => P.refundHold(tx, d.id, "ganda")); } catch { dbl = true; }
    ok(dbl, "hold yang sudah selesai tidak bisa diselesaikan dua kali");

    let over = false;
    try { await prisma.$transaction((tx) => P.hold(tx, B, null, 999_999, "bea", "lebih")); } catch { over = true; }
    ok(over, "hold melebihi saldo ditolak");

    // Balapan: 5 hold @10.000 bersamaan dari saldo 37.000 → tepat 3 lolos.
    const res = await Promise.allSettled(
      Array.from({ length: 5 }, () => prisma.$transaction((tx) => P.hold(tx, A, null, 10_000, "bea", "balap"))),
    );
    ok(res.filter((r) => r.status === "fulfilled").length === 3, "balapan: 3 dari 5 hold lolos");
    ok((await bal(A)) === 7_000, "saldo A 7.000, tidak negatif");

    for (const u of ids) ok((await sumTx(u)) === (await bal(u)), `Σ transaksi = saldo (${u})`);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
