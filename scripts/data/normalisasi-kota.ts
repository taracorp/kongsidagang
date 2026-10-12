// Rapikan kota barang Tukar Guling lama (teks bebas) ke nama kab/kota resmi bila cocok tepat satu.
// Idempoten. Jalankan: npx tsx --conditions=react-server scripts/data/normalisasi-kota.ts [--terapkan]
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { prisma } = await import("@/lib/db");
  const { cariKota, kotaSah } = await import("@/lib/wilayah");
  const terapkan = process.argv.includes("--terapkan");
  const rows = await prisma.barterItem.findMany({ where: { city: { not: null } }, select: { id: true, city: true } });
  let ubah = 0, ambigu = 0;
  for (const r of rows) {
    if (kotaSah(r.city)) continue;
    const kandidat = cariKota(r.city!, 3);
    if (kandidat.length === 1) {
      console.log(`"${r.city}" → ${kandidat[0].nama}`);
      if (terapkan) await prisma.barterItem.update({ where: { id: r.id }, data: { city: kandidat[0].nama } });
      ubah++;
    } else {
      console.log(`"${r.city}" → ambigu/tidak cocok (${kandidat.map((k) => k.nama).join(", ") || "-"}), dibiarkan`);
      ambigu++;
    }
  }
  console.log(`${terapkan ? "Diterapkan" : "Pratinjau"}: ${ubah} dirapikan, ${ambigu} dibiarkan, ${rows.length} total.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
