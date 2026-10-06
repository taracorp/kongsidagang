// Uji fungsi murni taksiran (Juru Taksir v2): npx tsx scripts/uji/taksiran.ts
import { taksir, nilaiSusut, faktorKondisi, bulatkan, type TaksiranCategory } from "@/lib/domain/taksiran";
import type { Statistik } from "@/lib/taksir/ekstrak";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const dekat = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= b * tol;

const beras: TaksiranCategory = {
  slug: "beras", name: "Beras", kind: "komoditas", unit: "kg", rate_y1: 0, rate_next: 0, floor_pct: 0,
  ship_weight_kg: 1, needs_serial: false, serial_label: null, price_per_unit: 15_000,
  checklist: [{ key: "kutu", q: "Kutu?", penalty: 0.4 }],
};
const sepeda: TaksiranCategory = {
  slug: "sepeda", name: "Sepeda", kind: "aset", unit: null, rate_y1: 0.2, rate_next: 0.15, floor_pct: 0.2,
  ship_weight_kg: 15, needs_serial: true, serial_label: "Nomor rangka", price_per_unit: null,
  checklist: [{ key: "rangka", q: "Retak?", penalty: 0.4 }, { key: "ban", q: "Ban?", penalty: 0.05 }],
};
const elektronik: TaksiranCategory = { ...sepeda, slug: "elektronik-rumah", name: "Elektronik", rate_y1: 0.25, rate_next: 0.15, floor_pct: 0.1, ship_weight_kg: 8 };
const lainnya: TaksiranCategory = { ...sepeda, slug: "lainnya", name: "Lainnya", rate_y1: 0.3, rate_next: 0.15, floor_pct: 0.1 };
const now = 2026;

// Komoditas tetap
ok(taksir(beras, { qty: 100, answers: {}, nowYear: now }).mid === 1_500_000, "beras 100kg × 15rb = 1,5jt");

// Nilai buku: dibeli baru vs dibeli bekas
const baruSaja = taksir(sepeda, { purchasePrice: 3_500_000, purchaseYear: 2023, boughtCondition: "baru", answers: {}, nowYear: now });
ok(baruSaja.mid === 2_023_000 && baruSaja.metode === "buku" && baruSaja.akurasi === "rendah", `dibeli baru 3,5jt 2023 → ${baruSaja.mid} (buku, rendah)`);
const bekasBeli = taksir(sepeda, { purchasePrice: 2_500_000, purchaseYear: 2025, boughtCondition: "bekas", answers: {}, nowYear: now });
ok(bekasBeli.mid === 2_125_000, `dibeli BEKAS 2,5jt 2025 → ${bekasBeli.mid} (tidak disusutkan dua kali; bukan 1,7jt)`);
const bekasRilis = taksir(sepeda, { purchasePrice: 2_000_000, purchaseYear: 2024, productionYear: 2020, boughtCondition: "bekas", answers: {}, nowYear: now });
ok(dekat(bekasRilis.mid, 2_000_000 * (0.8 * 0.85 ** 5) / (0.8 * 0.85 ** 3)), `dibeli bekas umur 4 th → pakai rasio kurva (${bekasRilis.mid})`);

// Dengan data pasar (angka dari riset nyata Polygon Cascade 4)
const pasarSepeda: Statistik = {
  baru: { n: 26, median: 4_718_400, q1: 3_562_500, q3: 5_410_000, min: 3_100_000, max: 5_930_000 },
  bekas: { n: 9, median: 2_800_000, q1: 2_400_000, q3: 2_800_000, min: 2_390_000, max: 3_000_000 },
};
const sp = taksir(sepeda, { purchasePrice: 4_500_000, purchaseYear: 2023, boughtCondition: "baru", answers: {}, nowYear: now, pasar: pasarSepeda });
ok(sp.metode === "pasar" && sp.akurasi === "tinggi", `pasar bekas cukup → metode pasar, akurasi ${sp.akurasi}`);
ok(sp.mid > 2_600_000 && sp.mid < 2_900_000, `Polygon Cascade 4 → ${sp.mid} (dekat median bekas 2,8jt)`);
const spRusak = taksir(sepeda, { purchasePrice: 4_500_000, purchaseYear: 2023, answers: { rangka: true }, nowYear: now, pasar: pasarSepeda });
ok(dekat(spRusak.mid, sp.mid * 0.6, 0.02), "rangka retak −40% tetap berlaku di atas harga pasar");
const tanpaHarga = taksir(sepeda, { purchaseYear: 2023, answers: {}, nowYear: now, pasar: pasarSepeda });
ok(tanpaHarga.mid > 0 && tanpaHarga.metode === "pasar", "harga beli boleh kosong bila data pasar ada");

// Hanya harga baru (TV Polytron dari riset nyata)
const pasarTv: Statistik = { baru: { n: 8, median: 2_672_500, q1: 2_450_000, q3: 2_679_875, min: 2_300_000, max: 2_690_000 }, bekas: null };
const tv = taksir(elektronik, { purchasePrice: 2_900_000, purchaseYear: 2024, boughtCondition: "baru", answers: {}, nowYear: now, pasar: pasarTv });
ok(tv.metode === "baru" && tv.akurasi === "sedang", `TV hanya harga baru → metode ${tv.metode}, akurasi ${tv.akurasi}`);
ok(dekat(tv.mid, 1_758_000, 0.02), `TV Polytron 2024 → ${tv.mid}`);

// Koleksi: nilai bisa naik
const pasarVespa: Statistik = { baru: null, bekas: { n: 3, median: 30_000_000, q1: 29_000_000, q3: 31_000_000, min: 28_000_000, max: 32_000_000 } };
const vespa = taksir(lainnya, { purchasePrice: 5_000_000, purchaseYear: 1990, isCollectible: true, answers: {}, nowYear: now, pasar: pasarVespa });
ok(vespa.metode === "koleksi" && vespa.mid > 5_000_000 * 4, `Vespa klasik beli 5jt (1990) → ${vespa.mid}: NAIK, tidak disusutkan`);
const kolTanpaPasar = taksir(lainnya, { purchasePrice: 2_000_000, purchaseYear: 2000, isCollectible: true, answers: {}, nowYear: now });
ok(kolTanpaPasar.mid === 2_000_000 && kolTanpaPasar.akurasi === "rendah", "koleksi tanpa pembanding → harga beli apa adanya, rendah");
ok(throws(() => taksir(lainnya, { purchaseYear: 2000, isCollectible: true, answers: {}, nowYear: now })), "koleksi tanpa pasar & tanpa harga → minta tera");

// Validasi
ok(throws(() => taksir(sepeda, { purchaseYear: 2023, answers: {}, nowYear: now })), "tanpa pasar & tanpa harga beli ditolak");
ok(throws(() => taksir(sepeda, { purchasePrice: 1_000_000, purchaseYear: 2022, productionYear: 2024, answers: {}, nowYear: now })), "tahun rilis setelah tahun beli ditolak");
ok(throws(() => taksir(sepeda, { purchasePrice: 1_000_000, purchaseYear: 2030, answers: {}, nowYear: now })), "tahun beli masa depan ditolak");

// Fungsi dasar
ok(nilaiSusut(1_000_000, 0, 0.2, 0.15, 0.2) === 900_000, "umur 0 → setengah susut tahun pertama");
ok(nilaiSusut(1_000_000, 30, 0.2, 0.15, 0.2) === 200_000, "tidak di bawah floor");
ok(faktorKondisi(sepeda.checklist, { rangka: true, ban: true }) === 0.55, "faktor kondisi 1 − 0,45");
ok(bulatkan(12_340) === 12_500 && bulatkan(123_456) === 123_000, "pembulatan 500 / 1.000");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
