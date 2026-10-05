// Mesin Taksiran Tukar Guling — fungsi murni (tanpa DB), dipakai server & pratinjau client.
// Server SELALU menghitung ulang saat menyimpan; angka dari client tidak dipercaya.
//
// Komoditas : qty × harga per satuan terbaru × faktor kondisi, rentang ±5%.
// Aset      : penyusutan saldo menurun (rate_y1, lalu rate_next per tahun, tak di bawah floor_pct)
//             × faktor kondisi dari checklist, rentang ±10%.

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
  purchasePrice?: number;
  purchaseYear?: number;
  answers: Record<string, boolean>; // true = kekurangan diakui
  nowYear: number;
};

export type Taksiran = {
  low: number;
  mid: number;
  high: number;
  condition: number; // 0.3–1
  shipWeightKg: number;
  steps: string[]; // rincian untuk ditampilkan ke user
};

const MIN_CONDITION = 0.3;
const MAX_PRICE = 1_000_000_000;
const MAX_QTY = 10_000;
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

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

export function taksir(cat: TaksiranCategory, input: TaksiranInput): Taksiran {
  const cond = faktorKondisi(cat.checklist, input.answers);
  const steps: string[] = [];
  let base: number;
  let spread: number;
  let weight: number;

  if (cat.kind === "komoditas") {
    const qty = input.qty ?? 0;
    if (!(qty > 0) || qty > MAX_QTY) throw new Error(`Isi jumlah (${cat.unit ?? "satuan"}) yang valid.`);
    if (!cat.price_per_unit) throw new Error(`Harga ${cat.name} belum tersedia.`);
    base = qty * cat.price_per_unit;
    spread = 0.05;
    weight = qty * cat.ship_weight_kg;
    steps.push(`${qty.toLocaleString("id-ID")} ${cat.unit ?? ""} × ${rp(cat.price_per_unit)} = ${rp(base)}`);
  } else {
    const price = input.purchasePrice ?? 0;
    const year = input.purchaseYear ?? 0;
    if (!Number.isInteger(price) || price <= 0 || price > MAX_PRICE) throw new Error("Isi harga beli yang valid.");
    if (!Number.isInteger(year) || year < 1980 || year > input.nowYear) throw new Error("Isi tahun beli yang valid.");
    const age = input.nowYear - year;
    base = nilaiSusut(price, age, cat.rate_y1, cat.rate_next, cat.floor_pct);
    spread = 0.1;
    weight = cat.ship_weight_kg;
    steps.push(`Harga beli ${rp(price)}, umur ${age} tahun`);
    steps.push(
      `Susut ${Math.round(cat.rate_y1 * 100)}% tahun pertama, ${Math.round(cat.rate_next * 100)}%/tahun berikutnya → ${rp(base)}`,
    );
  }

  if (cond < 1) steps.push(`Kondisi ${Math.round(cond * 100)}% (dari checklist) → ${rp(base * cond)}`);
  const mid = bulatkan(base * cond);
  return {
    low: bulatkan(mid * (1 - spread)),
    mid,
    high: bulatkan(mid * (1 + spread)),
    condition: cond,
    shipWeightKg: Math.round(weight * 10) / 10,
    steps,
  };
}
