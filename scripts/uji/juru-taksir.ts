// Uji riset Juru Taksir (driver tiruan) di kongsi_dev: npx tsx --conditions=react-server scripts/uji/juru-taksir.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.TAKSIR_MOCK = "true";
process.env.TAKSIR_MAKS_PER_HARI = "3";

async function main() {
  const { prisma } = await import("@/lib/db");
  const R = await import("@/lib/taksir/riset");
  const { taksir } = await import("@/lib/domain/taksiran");
  const { loadCategory } = await import("@/lib/domain/kategori");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const gagal = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch (e) { return (e as Error).message; } };
  const Q = ["Uji TV Polytron PLD 32T1850 32 inch", "Uji Vespa Super 1978", "Uji Barang Tanpa Data Zxq 123", "Uji Polytron Lain PLD 99", "Uji Polytron Ketiga PLD 77"];
  await prisma.priceResearch.deleteMany({ where: { query_text: { in: Q } } });

  try {
    const r1 = await R.risetHarga("uji-jt", Q[0], "elektronik-rumah");
    ok(!r1.dariCache && r1.statistik.baru?.n === 3 && r1.statistik.bekas?.n === 3, `riset baru: baru n=${r1.statistik.baru?.n}, bekas n=${r1.statistik.bekas?.n}`);
    ok(!r1.pembanding.some((p) => /backlight/i.test(p.judul)), "aksesoris (backlight 90rb) tidak masuk pembanding");
    const r1b = await R.risetHarga("uji-jt-lain", Q[0], "elektronik-rumah");
    ok(r1b.dariCache && r1b.id === r1.id, "kueri sama dari user lain → pakai cache (tanpa riset ulang)");
    const baca = await R.bacaRiset(r1.id);
    ok(baca?.kategori === "elektronik-rumah", "riset menyimpan kategori (dicek saat simpan barang)");

    const cat = (await loadCategory("elektronik-rumah"))!;
    const t = taksir(cat, { purchaseYear: 2024, boughtCondition: "baru", answers: {}, nowYear: 2026, pasar: baca!.statistik });
    ok(t.metode === "pasar" && t.mid > 1_000_000 && t.mid < 1_600_000, `taksiran dari riset: ${t.mid} (${t.metode}, ${t.akurasi})`);

    const r2 = await R.risetHarga("uji-jt", Q[1], "lainnya", { koleksi: true });
    const lain = (await loadCategory("lainnya"))!;
    const tv = taksir(lain, { purchasePrice: 5_000_000, purchaseYear: 1990, isCollectible: true, answers: {}, nowYear: 2026, pasar: r2.statistik });
    ok(tv.metode === "koleksi" && tv.mid > 20_000_000, `Vespa koleksi dari riset: ${tv.mid}`);

    const r3 = await R.risetHarga("uji-jt", Q[2], "lainnya");
    ok(r3.pembanding.length === 0 && !r3.statistik.baru && !r3.statistik.bekas, "barang tanpa data → riset kosong (taksiran pakai harga beli)");

    const batas = await gagal(() => R.risetHarga("uji-jt", Q[3], "elektronik-rumah"));
    ok(typeof batas === "string" && batas.includes("Batas"), "batas riset harian per user (3) ditegakkan");
    ok((await R.risetHarga("uji-jt-lain", Q[4], "elektronik-rumah")).id.length > 0, "user lain tidak terkena batas user pertama");

    const umum = await gagal(() => R.risetHarga("uji-jt-3", "tv bagus", "elektronik-rumah"));
    ok(typeof umum === "string" && umum.includes("merek"), "kueri terlalu umum ditolak (minta merek & tipe)");
  } finally {
    await prisma.priceResearch.deleteMany({ where: { query_text: { in: Q } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
