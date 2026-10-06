// Juru Taksir — pembaca harga, pencocok produk, deteksi kondisi, dan statistik.
// Fungsi murni (tanpa jaringan/DB) supaya mudah diuji dengan contoh nyata.

export type Kondisi = "baru" | "bekas";

export type Pembanding = {
  sumber: string; // nama toko/situs, mis. "Tokopedia", "OLX"
  judul: string;
  harga: number;
  kondisi: Kondisi;
  url: string;
  asal: "biggo" | "pencarian" | "internal";
};

export type Ringkas = { n: number; median: number; q1: number; q3: number; min: number; max: number };
export type Statistik = { baru: Ringkas | null; bekas: Ringkas | null };

// ------------------------------------------------------------
// Harga
// ------------------------------------------------------------

// Konteks yang berarti angka itu BUKAN harga barang.
const KONTEKS_BUKAN_HARGA =
  /(cicilan|angsuran|\bdp\b|uang muka|ongkir|ongkos kirim|sewa|rental|hemat|diskon|potongan|cashback|komisi|gaji|bonus|voucher|per ?bulan|\/ ?bln|\/ ?bulan|x ?\d{1,2} ?bulan)/i;

/** "2,5" / "2.5" (1–2 digit di belakang) = desimal; "1.500" = ribuan. */
function desimal(utama: string): number {
  if (/^\d+[.,]\d{1,2}$/.test(utama)) return Number(utama.replace(",", "."));
  return Number(utama.replace(/[.,]/g, ""));
}

function keAngka(utama: string, satuan: string | undefined): number | null {
  const s = (satuan ?? "").toLowerCase();
  if (s === "jt" || s === "juta") {
    const v = desimal(utama);
    return Number.isFinite(v) ? Math.round(v * 1_000_000) : null;
  }
  if (s === "rb" || s === "ribu" || s === "k") {
    const v = desimal(utama);
    return Number.isFinite(v) ? Math.round(v * 1_000) : null;
  }
  // Format rupiah penuh: titik/koma sebagai pemisah ribuan, sisa 1–2 digit di ujung = sen (dibuang).
  const bersih = utama.replace(/[.,]\d{1,2}$/, "").replace(/[.,]/g, "");
  const v = Number(bersih);
  return Number.isFinite(v) ? v : null;
}

/** Ambil semua harga rupiah yang masuk akal dari teks Indonesia. */
export function bacaHarga(teks: string): number[] {
  const hasil: number[] = [];
  const pola =
    /(Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)\s*(jt|juta|rb|ribu|k)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(teks))) {
    const [, rp, utama, satuan] = m;
    if (!rp && !satuan) continue; // angka polos (ukuran, tahun, kode) bukan harga
    if (!rp && satuan?.toLowerCase() === "k" && Number(utama) < 10) continue;
    // Konteks hanya dari klausa yang sama (berhenti di koma/titik koma/"jadi"/"harga"/dst.).
    const jendela = teks.slice(Math.max(0, m.index - 30), m.index);
    const potong = [...jendela.matchAll(/[,;|•\n]|\b(jadi|menjadi|harga|cuma|hanya|tinggal|sekarang|nett?)\b/gi)].pop();
    const sebelum = potong ? jendela.slice(potong.index! + potong[0].length) : jendela;
    const sesudah = teks.slice(m.index + m[0].length, m.index + m[0].length + 14);
    if (KONTEKS_BUKAN_HARGA.test(sebelum) || /^\s*(\/|per|x\s?\d)/i.test(sesudah)) continue;
    const v = keAngka(utama, satuan);
    if (v && v >= 1_000 && v <= 5_000_000_000) hasil.push(v);
  }
  return hasil;
}

// ------------------------------------------------------------
// Pencocok produk
// ------------------------------------------------------------

const KATA_UMUM = new Set([
  "harga", "jual", "dijual", "beli", "baru", "bekas", "second", "seken", "murah", "original", "ori", "asli",
  "inch", "inchi", "inci", "in", "tv", "led", "smart", "digital", "android", "unit", "set", "dan", "plus",
  "dengan", "untuk", "the", "new", "promo", "resmi", "garansi", "termurah", "terbaru", "kondisi", "mulus",
  "type", "tipe", "seri", "series", "model", "merk", "merek", "warna", "ukuran", "full", "hd",
]);

// Merek umum — kalau disebut di kueri, wajib ada di judul pembanding.
const MEREK = new Set([
  "polytron", "samsung", "lg", "sharp", "sony", "panasonic", "toshiba", "tcl", "coocaa", "changhong", "aqua",
  "xiaomi", "redmi", "poco", "oppo", "vivo", "realme", "infinix", "tecno", "iphone", "apple", "ipad", "macbook",
  "asus", "acer", "lenovo", "hp", "dell", "msi", "huawei", "honor", "nokia", "advan", "axioo", "evercoss",
  "polygon", "united", "pacific", "thrill", "element", "wimcycle", "giant", "trek", "specialized", "brompton",
  "fnhon", "dahon", "canon", "nikon", "fujifilm", "olympus", "pentax", "leica", "gopro", "dji",
  "honda", "yamaha", "suzuki", "kawasaki", "vespa", "piaggio", "toyota", "daihatsu", "mitsubishi",
  "casio", "seiko", "citizen", "rolex", "fossil", "alexandre", "adidas", "nike", "puma", "converse", "vans",
  "miyako", "cosmos", "maspion", "philips", "electrolux", "modena", "denpoo", "kirin", "rinnai", "midea", "gree",
  "daikin", "playstation", "nintendo", "xbox", "logitech", "yamaha", "cort", "ibanez", "fender", "gibson",
]);

// Kata aksesoris/suku cadang — dibuang bila TIDAK disebut di kueri.
const AKSESORIS = [
  "backlight", "back light", "bracket", "breket", "braket", "remote", "kabel", "adaptor", "adapter", "charger",
  "casing", "case", "cover", "tempered", "anti gores", "antigores", "sparepart", "spare part", "mainboard",
  "main board", "panel lcd", "layar lcd", "lcd panel", "inverter", "t-con", "tcon", "power supply", "psu",
  "led strip", "lampu led", "stiker", "sticker", "sarung", "pelindung", "modul", "komponen", "dudukan",
  "service", "servis", "jasa", "sewa", "rental", "ban dalam", "ban luar", "sadel", "rantai", "pedal",
  "strap", "tali jam", "baterai", "battery", "lensa cap", "tutup lensa", "dus kosong", "box kosong",
];

function normal(s: string) {
  return s
    .toLowerCase()
    .replace(/(\d+)\s*(?:"|''|”|inch|inchi|inci|in)\b/g, "$1 inch")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const rapat = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export type TokenKueri = { kuat: string[]; biasa: string[] };

/** Token kuat: kode model (huruf+angka), angka ukuran, dan merek. Token biasa: kata lain yang bermakna. */
export function tokenKueri(kueri: string): TokenKueri {
  const kuat: string[] = [];
  const biasa: string[] = [];
  for (const t of normal(kueri).split(" ")) {
    if (!t || KATA_UMUM.has(t)) continue;
    const r = rapat(t);
    if (!r) continue;
    const adaAngka = /\d/.test(r);
    const adaHuruf = /\p{L}/u.test(r);
    if (adaAngka && /^(19|20)\d\d$/.test(r)) continue; // tahun: tidak selalu ada di judul
    if ((adaAngka && adaHuruf) || (adaAngka && r.length <= 3) || MEREK.has(r)) kuat.push(r);
    else if (r.length >= 3) biasa.push(r);
  }
  return { kuat: [...new Set(kuat)], biasa: [...new Set(biasa)] };
}

/** Skor 0–1 kecocokan judul dengan kueri; 0 = tidak cocok (ada token kuat yang hilang / aksesoris). */
export function skorCocok(tk: TokenKueri, kueriAsli: string, judul: string): number {
  const j = normal(judul);
  const jr = rapat(judul);
  const kuer = normal(kueriAsli);
  for (const a of AKSESORIS) {
    if (j.includes(a) && !kuer.includes(a)) return 0;
  }
  // Angka murni (mis. ukuran 32) harus berdiri sendiri, bukan bagian dari angka lain.
  const kuatCocok = tk.kuat.every((t) =>
    /^\d+$/.test(t) ? new RegExp(`(^|\\D)${t}(\\D|$)`).test(j) : jr.includes(t),
  );
  if (!kuatCocok) return 0;
  if (tk.biasa.length === 0) return tk.kuat.length ? 1 : 0;
  const kena = tk.biasa.filter((t) => jr.includes(t)).length / tk.biasa.length;
  // ≥2 token kuat cocok semua (mis. merek + kode model) = produk yang sama; kata biasa hanya penguat skor.
  if (tk.kuat.length >= 2) return 0.5 + kena / 2;
  if (tk.kuat.length === 0 && kena < 0.6) return 0;
  if (kena < 0.34) return 0;
  return 0.5 + kena / 2;
}

// ------------------------------------------------------------
// Kondisi
// ------------------------------------------------------------

const POLA_BEKAS = /\b(bekas|second|seken|2nd|preloved|pre-loved|bkas|ex\s|eks\s|like new|likenew|kondisi \d+ ?%|normal pemakaian|minus)\b/i;
const SITUS_BEKAS = /(olx\.co\.id|jualo\.com|facebook\.com\/marketplace|carousell|kaskus\.co\.id\/fjb)/i;

export function deteksiKondisi(judul: string, url: string, sumber: string): Kondisi {
  if (POLA_BEKAS.test(judul) || SITUS_BEKAS.test(url) || /olx|jualo/i.test(sumber)) return "bekas";
  return "baru";
}

// ------------------------------------------------------------
// Statistik
// ------------------------------------------------------------

function kuantil(urut: number[], p: number): number {
  if (urut.length === 1) return urut[0];
  const i = (urut.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(urut[lo] + (urut[hi] - urut[lo]) * (i - lo));
}

/** Ringkas harga: buang outlier (IQR 1,5) bila n ≥ 4. */
export function ringkas(harga: number[]): Ringkas | null {
  if (harga.length === 0) return null;
  let urut = [...harga].sort((a, b) => a - b);
  if (urut.length >= 4) {
    const q1 = kuantil(urut, 0.25);
    const q3 = kuantil(urut, 0.75);
    const iqr = q3 - q1;
    const bersih = urut.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    if (bersih.length >= 2) urut = bersih;
  }
  return {
    n: urut.length,
    median: kuantil(urut, 0.5),
    q1: kuantil(urut, 0.25),
    q3: kuantil(urut, 0.75),
    min: urut[0],
    max: urut[urut.length - 1],
  };
}

/**
 * Saring & ringkas pembanding:
 * - buang duplikat (URL sama, atau judul+harga sama);
 * - buang yang jauh di bawah median barang baru (sisa aksesoris yang lolos saringan kata).
 */
export function olahPembanding(list: Pembanding[]): { pembanding: Pembanding[]; statistik: Statistik } {
  const lihat = new Set<string>();
  let unik = list.filter((p) => {
    const k1 = p.url.split("?")[0];
    const k2 = `${rapat(p.judul)}|${p.harga}`;
    if (lihat.has(k1) || lihat.has(k2)) return false;
    lihat.add(k1);
    lihat.add(k2);
    return true;
  });
  const awalBaru = ringkas(unik.filter((p) => p.kondisi === "baru").map((p) => p.harga));
  if (awalBaru && awalBaru.n >= 3) {
    unik = unik.filter((p) => p.harga >= awalBaru.median * 0.15);
  }
  const baru = ringkas(unik.filter((p) => p.kondisi === "baru").map((p) => p.harga));
  const bekas = ringkas(unik.filter((p) => p.kondisi === "bekas").map((p) => p.harga));
  // Simpan hanya pembanding yang masuk rentang statistik (setelah outlier dibuang).
  const masuk = (p: Pembanding) => {
    const r = p.kondisi === "baru" ? baru : bekas;
    return !!r && p.harga >= r.min && p.harga <= r.max;
  };
  return { pembanding: unik.filter(masuk), statistik: { baru, bekas } };
}

/** Kunci cache riset: kueri ternormalisasi + kategori. */
export function kunciRiset(kueri: string, kategori: string): string {
  return `${kategori}:${normal(kueri)}`.slice(0, 200);
}
