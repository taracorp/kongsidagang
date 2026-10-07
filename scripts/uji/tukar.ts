// Uji alur Tukar Guling v2 (COD) di kongsi_dev: npx tsx --conditions=react-server scripts/uji/tukar.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.ENABLE_TOPUP_DEMO = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const T = await import("@/lib/domain/tukar");
  const R = await import("@/lib/domain/tukar-aturan");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const gagal = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

  const ids = ["uji-tukar-a", "uji-tukar-b", "uji-tukar-c"];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const [A, B, C] = ids;
  const bal = async (u: string) => (await prisma.wallet.findUnique({ where: { user_id: u } }))?.balance ?? 0;
  const item = (user_id: string, title: string, est_value: number) =>
    prisma.barterItem.create({ data: { user_id, title, est_value, status: "aktif" } });
  const deal = (id: string) => prisma.barterDeal.findUniqueOrThrow({ where: { id } });

  try {
    // Aturan murni
    ok(R.beaTukar(20_000) === 2_000 && R.beaTukar(80_000) === 8_000 && R.beaTukar(1_500_000) === 10_000, "bea 10% maks 10rb");
    ok(R.bolehkah("proposed", "b", "terima") && !R.bolehkah("proposed", "a", "terima"), "hanya penerima boleh menerima");
    ok(!R.bolehkah("proposed", "a", "pindai") && !R.bolehkah("done", "a", "batal_di_tempat"), "transisi ilegal ditolak");

    for (const u of ids) await P.topupDemo(u, "106000"); // 106.000 masing-masing
    const beras = await item(A, "Beras 100kg", 1_500_000);
    const sepeda = await item(B, "Sepeda Polygon", 1_900_000);
    const hp = await item(C, "HP bekas", 1_000_000);

    // Ajukan: A lebih rendah 400rb → wajib tambah ≥ 400rb. Saldo A 106rb → gagal.
    ok(await gagal(() => T.ajukan(A, beras.id, sepeda.id, 0)), "A lebih rendah tanpa tambah ditolak");
    ok(await gagal(() => T.ajukan(A, beras.id, sepeda.id, 400_000)), "saldo kurang untuk tambah 400rb ditolak");
    await P.topupDemo(A, "270000"); // +270rb → 376rb
    await P.topupDemo(A, "270000"); // → 646rb
    const d1 = await T.ajukan(A, beras.id, sepeda.id, 400_000);
    ok((await bal(A)) === 646_000 - 10_000 - 400_000, "A menahan bea 10rb + tambah 400rb");
    ok(await gagal(() => T.ajukan(A, beras.id, sepeda.id, 400_000)), "ajuan ganda ditolak");

    // C juga mengajukan ke sepeda (akan otomatis ditolak saat B menerima A).
    const d2 = await T.ajukan(C, hp.id, sepeda.id, 900_000).catch(() => null);
    ok(d2 === null, "C saldo kurang untuk tambah 900rb");
    await P.topupDemo(C, "270000"); await P.topupDemo(C, "270000"); await P.topupDemo(C, "270000");
    const c0 = await bal(C);
    const d3 = await T.ajukan(C, hp.id, sepeda.id, 900_000);

    ok(await gagal(() => T.terima(A, d1, { meetType: "minimarket", meetPlace: "Indomaret Kaliurang" })), "pengaju tidak bisa menerima sendiri");
    ok(await gagal(() => T.terima(B, d1, { meetType: "rumah", meetPlace: "Rumahku" })), "Titik Aman wajib dari daftar");
    await T.terima(B, d1, { meetType: "minimarket", meetPlace: "Indomaret Kaliurang km 5" });
    ok((await bal(B)) === 106_000 - 10_000, "B menahan bea 10rb saat menerima");
    ok((await deal(d3)).status === "rejected" && (await bal(C)) === c0, "tawaran C otomatis ditolak, rekber C kembali");
    ok((await prisma.barterItem.findUniqueOrThrow({ where: { id: sepeda.id } })).status === "dalam_tukar", "barang terkunci dalam_tukar");

    // Pindai
    const dd = await deal(d1);
    const kodeA = T.kodeKetemu(d1, "a", dd.agreed_at!);
    const kodeB = T.kodeKetemu(d1, "b", dd.agreed_at!);
    ok(await gagal(() => T.pindai(B, d1, "000000" === kodeA ? "111111" : "000000")), "kode salah ditolak");
    ok((await deal(d1)).scan_fails === 1, "kode salah tercatat (tidak ikut rollback)");
    ok(await gagal(() => T.pindai(C, d1, kodeA)), "orang luar tidak bisa memindai");
    const r1 = await T.pindai(B, d1, `KDT:${d1}:${kodeA}`);
    ok(!r1.done, "satu pindaian belum selesai");
    const r2 = await T.pindai(A, d1, kodeB);
    ok(r2.done && (await deal(d1)).status === "done", "dua pindaian → selesai");
    ok((await bal(B)) === 96_000 + 400_000, "B menerima tambahan 400rb");
    ok((await bal(A)) === 236_000, "A: bea diambil, tambah pindah ke B");
    const holds = await prisma.walletHold.findMany({ where: { deal_id: d1 } });
    ok(holds.every((h) => h.status !== "ditahan") && holds.filter((h) => h.kind === "bea").every((h) => h.status === "diambil"), "semua rekber tuntas, bea diambil");
    ok((await prisma.barterItem.count({ where: { id: { in: [beras.id, sepeda.id] }, status: "ditukar" } })) === 2, "kedua barang ditukar");
    ok(await gagal(() => T.pindai(A, d1, kodeB)), "deal selesai tidak bisa dipindai lagi");

    // Batal di tempat: semua kembali
    const buku = await item(A, "Buku", 20_000);
    const kaos = await item(C, "Kaos", 20_000);
    const a0 = await bal(A), cc0 = await bal(C);
    const d4 = await T.ajukan(A, buku.id, kaos.id, 0);
    await T.terima(C, d4, { meetType: "kedai", meetPlace: "Kopi Kenangan Seturan" });
    ok((await bal(A)) === a0 - 2_000 && (await bal(C)) === cc0 - 2_000, "barang 20rb → bea 2rb tiap pihak");
    await T.batalDiTempat(C, d4, "barang tidak sesuai");
    ok((await bal(A)) === a0 && (await bal(C)) === cc0, "batal di tempat → bea kembali");
    ok((await prisma.barterItem.count({ where: { id: { in: [buku.id, kaos.id] }, status: "aktif" } })) === 2, "barang kembali aktif");

    // Kedaluwarsa
    const d5 = await T.ajukan(A, buku.id, kaos.id, 0);
    await T.terima(C, d5, { meetType: "polisi", meetPlace: "Polsek Depok Barat" });
    await prisma.barterDeal.update({ where: { id: d5 }, data: { expires_at: new Date(Date.now() - 1000) } });
    const n = (await T.majukanTukar()).kedaluwarsa;
    ok(n >= 1 && (await deal(d5)).status === "expired" && (await bal(A)) === a0, "lewat 72 jam → kedaluwarsa, rekber kembali");

    // Sengketa → putus selesai
    const d6 = await T.ajukan(A, buku.id, kaos.id, 0);
    await T.terima(C, d6, { meetType: "mal", meetPlace: "Plaza Ambarrukmo" });
    await T.sengketa(A, d6, "Tidak datang dan minta transfer di luar aplikasi");
    ok((await deal(d6)).status === "disputed", "sengketa tercatat, rekber tetap ditahan");
    await T.putus(d6, "batal");
    ok((await deal(d6)).status === "resolved" && (await bal(A)) === a0, "Syahbandar batalkan → rekber kembali");

    for (const u of ids) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: u }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(u)), `Σ transaksi = saldo (${u})`);
    }
  } finally {
    await prisma.barterItem.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.walletHold.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
