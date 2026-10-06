// Mesin Taksiran Tukar Guling — fungsi murni (tanpa DB), dipakai server & pratinjau client.
// Server SELALU menghitung ulang saat menyimpan; angka dari client tidak dipercaya.
//
// Komoditas : qty × harga per satuan terbaru × faktor kondisi.
// Aset      : paduan tiga sumber, sesuai data yang ada:
//   1. pasar bekas (riset Juru Taksir) — paling dipercaya;
//   2. harga baru SEKARANG × kurva susut sejak rilis;
//   3. nilai buku dari harga beli (dibeli bekas → tidak disusutkan dua kali).
// Koleksi   : tanpa penyusutan; nilai mengikuti pasar (boleh di atas harga beli).

import type { Ringkas, Statistik } from "@/lib/taksir/ekstrak";

export type ChecklistItem = { key: string; q: string; penalty: number };

export type TaksiranCategory = {
  slug: string;
  name: string;
  kind: "komoditas" | "aset";
  unit: string | null;
  rate_y1: number;
  rate_next: number;
  floor_pct: number;
  ship_weight_kg: number;
  needs_serial: boolean;
  serial_label: string | null;
  checklist: ChecklistItem[];
  price_per_unit: number | null; // komoditas: harga terbaru
};

export type TaksiranInput = {
  qty?: number;
  purchasePrice?: number; // boleh 0/kosong bila data pasar tersedia
  purchaseYear?: number;
  productionYear?: number; // tahun rilis/produksi (opsional)
  boughtCondition?: "baru" | "bekas";
  isCollectible?: boolean;
  answers: Record<string, boolean>; // true = kekurangan diakui
  nowYear: number;
  pasar?: Statistik | null; // hasil riset harga pasar
};

export type Akurasi = "tinggi" | "sedang" | "rendah";
export type Metode = "komoditas" | "pasar" | "baru" | "buku" | "koleksi";

export type Taksiran = {
  low: number;
  mid: number;
  high: number;
  condition: number; // 0.3–1
  shipWeightKg: number;
  metode: Metode;
  akurasi: Akurasi;
  steps: string[]; // rincian untuk ditampilkan ke user
};

const MIN_CONDITION = 0.3;
const MAX_PRICE = 10_000_000_000;
const MAX_QTY = 10_000;
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Bulatkan ke 500 (barang kecil) atau 1.000 supaya angka enak dibaca. */
export function bulatkan(n: number): number {
  const step = n < 50_000 ? 500 : 1_000;
  return Math.max(step, Math.round(n / step) * step);
}

export function faktorKondisi(list: ChecklistItem[], answers: Record<string, boolean>): number {
  const cut = list.reduce((s, c) => s + (answers[c.key] ? c.penalty : 0), 0);
  return Math.max(MIN_CONDITION, 1 - cut);
}

/**
 * Nilai buku setelah `age` tahun. Umur 0 (dibeli tahun ini) tetap kena setengah susut tahun pertama
 * karena barang sudah bekas pakai.
 */
export function nilaiSusut(price: number, age: number, y1: number, next: number, floor: number): number {
  let v: number;
  if (age <= 0) v = price * (1 - y1 / 2);
  else {
    v = price * (1 - y1);
    for (let i = 2; i <= age; i++) v *= 1 - next;
  }
  return Math.max(v, price * floor);
}

/** Sebaran relatif setengah rentang Q1–Q3 terhadap median. */
function sebaran(r: Ringkas) {
  return r.median > 0 ? (r.q3 - r.q1) / (2 * r.median) : 1;
}

function taksirKomoditas(cat: TaksiranCategory, input: TaksiranInput, cond: number): Taksiran {
  const qty = input.qty ?? 0;
  if (!(qty > 0) || qty > MAX_QTY) throw new Error(`Isi jumlah (${cat.unit ?? "satuan"}) yang valid.`);
  if (!cat.price_per_unit) throw new Error(`Harga ${cat.name} belum tersedia.`);
  const base = qty * cat.price_per_unit;
  const steps = [`${qty.toLocaleString("id-ID")} ${cat.unit ?? ""} × ${rp(cat.price_per_unit)} = ${rp(base)}`];
  if (cond < 1) steps.push(`Kondisi ${Math.round(cond * 100)}% (dari checklist) → ${rp(base * cond)}`);
  const mid = bulatkan(base * cond);
  return {
    low: bulatkan(mid * 0.95),
    mid,
    high: bulatkan(mid * 1.05),
    condition: cond,
    shipWeightKg: Math.round(qty * cat.ship_weight_kg * 10) / 10,
    metode: "komoditas",
    akurasi: "sedang",
    steps,
  };
}

export function taksir(cat: TaksiranCategory, input: TaksiranInput): Taksiran {
  const cond = faktorKondisi(cat.checklist, input.answers);
  if (cat.kind === "komoditas") return taksirKomoditas(cat, input, cond);

  const now = input.nowYear;
  const koleksi = !!input.isCollectible;
  const bekasSaatBeli = input.boughtCondition === "bekas";
  const tahunMin = koleksi ? 1900 : 1970;
  const year = input.purchaseYear ?? 0;
  if (!Number.isInteger(year) || year < tahunMin || year > now) throw new Error("Isi tahun beli yang valid.");
  const prod = input.productionYear;
  if (prod !== undefined && prod !== 0) {
    if (!Number.isInteger(prod) || prod < 1900 || prod > now) throw new Error("Tahun rilis/produksi tidak valid.");
    if (prod > year) throw new Error("Tahun rilis tidak boleh setelah tahun beli.");
  }
  const price = input.purchasePrice ?? 0;
  if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) throw new Error("Harga beli tidak valid.");

  const f = (age: number) => nilaiSusut(1, age, cat.rate_y1, cat.rate_next, cat.floor_pct);
  // Umur sejak barang dibuat. Dibeli bekas tanpa tahun rilis → anggap minimal 1 tahun saat dibeli.
  const umurSaatBeli = prod ? year - prod : bekasSaatBeli ? 1 : 0;
  const umurKini = now - year + umurSaatBeli;

  const steps: string[] = [];
  const bekas = input.pasar?.bekas ?? null;
  const baru = input.pasar?.baru ?? null;

  // ---------- Nilai buku dari harga beli ----------
  let buku: number | null = null;
  if (price > 0) {
    if (koleksi) {
      buku = price;
      steps.push(`Barang koleksi: harga beli ${rp(price)} tidak disusutkan`);
    } else if (bekasSaatBeli) {
      buku = (price * f(umurKini)) / f(umurSaatBeli);
      steps.push(
        `Dibeli bekas ${rp(price)} (umur ±${umurSaatBeli} th) → kini ±${umurKini} th: nilai buku ${rp(buku)}`,
      );
    } else {
      buku = price * f(umurKini);
      steps.push(`Dibeli baru ${rp(price)}, umur ${umurKini} th → nilai buku ${rp(buku)}`);
    }
  }

  // ---------- Koleksi: ikut pasar, tanpa penyusutan ----------
  if (koleksi) {
    // Listing barang antik jarang menulis "bekas": gabungkan baru & bekas, berbobot jumlah pembanding.
    const parts = [bekas, baru].filter((r): r is Ringkas => !!r && r.n > 0);
    const n = parts.reduce((s, r) => s + r.n, 0);
    if (n >= 3) {
      const median = parts.reduce((s, r) => s + r.median * r.n, 0) / n;
      const sp = clamp(parts.reduce((s, r) => s + sebaran(r) * r.n, 0) / n, 0.1, 0.35);
      steps.push(`Pasar kolektor: ${n} pembanding, median ${rp(median)}`);
      const base = buku ? median * 0.85 + buku * 0.15 : median;
      return hasil(base, sp, n >= 5 && sp <= 0.25 ? "tinggi" : "sedang", "koleksi");
    }
    if (!buku) throw new Error("Belum ada pembanding pasar — isi harga beli, atau minta tera Penaksir.");
    return hasil(buku, 0.25, "rendah", "koleksi");
  }

  // ---------- Barang biasa ----------
  const calon: { v: number; w: number }[] = [];
  let metode: Metode = "buku";
  let sp = 0.2;
  let akurasi: Akurasi = "rendah";

  let hargaBaruKini: number | null = null;
  if (baru && baru.n >= 2) {
    hargaBaruKini = baru.median;
    const v = baru.median * f(umurKini);
    calon.push({ v, w: 0.25 });
    steps.push(`Harga baru sekarang ${rp(baru.median)} (${baru.n} toko) × susut ${umurKini} th → ${rp(v)}`);
    metode = "baru";
    sp = 0.15;
    if (baru.n >= 3) akurasi = "sedang";
  }
  if (bekas && bekas.n >= 3) {
    // Bekas lebih mahal dari baru = data tercampur; batasi.
    const v = hargaBaruKini ? Math.min(bekas.median, hargaBaruKini * 0.9) : bekas.median;
    calon.push({ v, w: bekas.n >= 5 ? 0.65 : 0.55 });
    steps.push(`Pasar bekas: ${bekas.n} pembanding, median ${rp(bekas.median)}`);
    metode = "pasar";
    sp = clamp(sebaran(bekas), 0.06, 0.3);
    akurasi = bekas.n >= 5 && sp <= 0.2 ? "tinggi" : "sedang";
  }
  if (buku) calon.push({ v: buku, w: calon.length ? 0.15 : 1 });
  if (calon.length === 0) {
    throw new Error("Belum ada pembanding pasar untuk barang ini — isi harga beli agar bisa ditaksir.");
  }
  const totalW = calon.reduce((s, c) => s + c.w, 0);
  const base = calon.reduce((s, c) => s + c.v * c.w, 0) / totalW;
  return hasil(base, sp, akurasi, metode);

  function hasil(base: number, spread: number, ak: Akurasi, mt: Metode): Taksiran {
    if (cond < 1) steps.push(`Kondisi ${Math.round(cond * 100)}% (dari checklist) → ${rp(base * cond)}`);
    const mid = bulatkan(base * cond);
    return {
      low: bulatkan(mid * (1 - spread)),
      mid,
      high: bulatkan(mid * (1 + spread)),
      condition: cond,
      shipWeightKg: cat.ship_weight_kg,
      metode: mt,
      akurasi: ak,
      steps,
    };
  }
}
