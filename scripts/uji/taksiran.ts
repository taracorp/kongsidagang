// Uji fungsi murni taksiran: npx tsx scripts/uji/taksiran.ts
import { taksir, nilaiSusut, faktorKondisi, bulatkan, type TaksiranCategory } from "@/lib/domain/taksiran";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

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

const b = taksir(beras, { qty: 100, answers: {}, nowYear: 2026 });
ok(b.mid === 1_500_000, `beras 100kg × 15rb = ${b.mid}`);
ok(b.low === 1_425_000 && b.high === 1_575_000, `rentang beras ±5% ${b.low}–${b.high}`);
ok(b.shipWeightKg === 100, "berat kirim beras 100kg");
ok(taksir(beras, { qty: 100, answers: { kutu: true }, nowYear: 2026 }).mid === 900_000, "beras berkutu −40% → 900rb");

const s = taksir(sepeda, { purchasePrice: 3_500_000, purchaseYear: 2023, answers: {}, nowYear: 2026 });
ok(s.mid === 2_023_000, `sepeda 3,5jt umur 3 th = ${s.mid} (≈2,02jt)`);
ok(s.low === 1_821_000 && s.high === 2_225_000, `rentang sepeda ±10% ${s.low}–${s.high}`);
ok(s.shipWeightKg === 15, "berat kirim sepeda dikunci 15kg");
ok(nilaiSusut(1_000_000, 0, 0.2, 0.15, 0.2) === 900_000, "umur 0 → setengah susut tahun pertama");
ok(nilaiSusut(1_000_000, 30, 0.2, 0.15, 0.2) === 200_000, "tidak di bawah floor 20%");
ok(faktorKondisi(sepeda.checklist, { rangka: true, ban: true }) === 0.55, "faktor kondisi 1 − 0,45");
ok(faktorKondisi([{ key: "a", q: "", penalty: 0.9 }], { a: true }) === 0.3, "faktor kondisi minimal 0,3");
ok(bulatkan(12_340) === 12_500 && bulatkan(123_456) === 123_000, "pembulatan 500 / 1.000");

ok(throws(() => taksir(beras, { qty: 0, answers: {}, nowYear: 2026 })), "qty 0 ditolak");
ok(throws(() => taksir({ ...beras, price_per_unit: null }, { qty: 5, answers: {}, nowYear: 2026 })), "tanpa harga komoditas ditolak");
ok(throws(() => taksir(sepeda, { purchasePrice: 3_500_000, purchaseYear: 2030, answers: {}, nowYear: 2026 })), "tahun masa depan ditolak");
ok(throws(() => taksir(sepeda, { purchasePrice: -5, purchaseYear: 2024, answers: {}, nowYear: 2026 })), "harga negatif ditolak");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
