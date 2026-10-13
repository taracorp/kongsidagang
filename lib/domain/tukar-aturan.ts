// Aturan Tukar Guling — fungsi murni (tanpa DB), dipakai server & client (kalkulator, label).
//
// v3 (Ch 8.35, arahan Tara): platform tidak menanggung risiko; risiko ke pihak yang salah; tanpa ganti rugi antar-user.
// - Selisih nilai dibayar UANG (DOKU) oleh pihak bernilai lebih rendah, ditahan Kongsi (rekber), diteruskan ke
//   rekening penerima saat tukar selesai (maks 2 hari kerja) atau dikembalikan saat batal.
// - Keteng hanya untuk jaminan: bea, cadangan, deposit, ongkir.
// - Ajukan gratis; bayar SETELAH tawaran diterima, tenggat 12 jam (tidak jatuh di jam tidur).

import { METODE, METODE_SELISIH, rincianBayar } from "@/lib/payment/biaya";

export const BEA_PERSEN = 0.1;
export const BEA_MAKS = 10_000;
export const JAM_COD = 72; // batas waktu ketemuan setelah sepakat
export const JAM_TAWARAN = 72; // tawaran tak dijawab kedaluwarsa
export const MAKS_TAWARAN_AKTIF = 3; // tawaran "menunggu jawaban" per pengaju
export const MAKS_GAGAL_PINDAI = 10;
export const JAM_BAYAR = 12; // setelah diterima: pembayaran/jaminan dilunasi
export const JAM_BAYAR_ONGKIR = 12; // mode Kirim: order kurir dibuat setelah semua lunas
export const JAM_KONFIRMASI = 72; // kedua paket sampai → konfirmasi otomatis setelah ini
export const PENGINGAT_KONFIRMASI_JAM = [24, 6]; // pengingat sebelum konfirmasi otomatis
export const PENGINGAT_BAYAR_JAM = 2; // pengingat sebelum tenggat bayar
export const JAM_PENAHANAN_SILANG = 48; // satu pihak sudah kirim, pihak lain belum → Syahbandar
export const HARI_ESKALASI = 7; // sengketa belum diputus → kabar ke Ketua
export const SELISIH_MAKS_PERSEN = 0.5; // selisih uang maks 50% nilai barang termahal
export const BIAYA_TRANSFER = 2_500; // biaya transfer bank (BI-FAST) per pencairan / pengembalian
export const HARI_KERJA_PENCAIRAN = 2;

export const BATAS_STRIKE = 3;
export const HARI_STRIKE = 30;
export const HARI_BLOKIR = 30;

export const DEPOSIT_PERSEN = 0.1;
export const DEPOSIT_MIN = 5_000;
export const DEPOSIT_MAKS = 200_000;

/**
 * Deposit mode Kirim per pihak: 10% taksiran barang sendiri (min 5rb, maks 200rb), dan tidak kurang dari ongkir
 * paket yang ia kirim — menutup retur/selisih berat yang ia timbulkan. Kembali utuh saat selesai.
 */
export function depositKirim(value: number, ongkirKeluar = 0): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const dasar = Math.min(DEPOSIT_MAKS, Math.max(DEPOSIT_MIN, Math.ceil(value * DEPOSIT_PERSEN)));
  return Math.max(dasar, Math.max(0, Math.round(ongkirKeluar)));
}

export type ModeTukar = "cod" | "kirim";

/** Bea Tukar per pihak: 10% taksiran barangnya sendiri, maks 10.000 Keteng. */
export function beaTukar(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(BEA_MAKS, Math.ceil(value * BEA_PERSEN));
}

export type Pihak = "a" | "b";
export const lawanDari = (p: Pihak): Pihak => (p === "a" ? "b" : "a");

/**
 * Selisih nilai: pihak bernilai lebih rendah membayar selisih (uang).
 * A (pengaju) lebih rendah → A wajib membayar minimal selisih.
 * A lebih tinggi → A boleh meminta B membayar 0…selisih (A boleh merelakan).
 * Semua dibatasi 50% nilai barang termahal.
 */
export function hitungSelisih(valueA: number, valueB: number) {
  const diff = Math.abs(valueA - valueB);
  const cap = Math.floor(Math.max(valueA, valueB) * SELISIH_MAKS_PERSEN);
  if (diff === 0) return { from: null as Pihak | null, diff: 0, min: 0, max: 0, cap };
  if (valueA < valueB) return { from: "a" as Pihak, diff, min: diff, max: Math.min(diff * 2, cap), cap };
  return { from: "b" as Pihak, diff, min: 0, max: Math.min(diff, cap), cap };
}

export function validasiTambah(valueA: number, valueB: number, topup: number): Pihak | null {
  const s = hitungSelisih(valueA, valueB);
  if (!Number.isInteger(topup) || topup < 0) throw new Error("Selisih tidak valid.");
  if (s.from === null) {
    if (topup !== 0) throw new Error("Nilai sudah seimbang — tidak perlu selisih.");
    return null;
  }
  if (s.from === "a" && s.min > s.cap) {
    throw new Error(
      `Selisih ${s.diff.toLocaleString("id-ID")} melebihi batas 50% nilai barang termahal (${s.cap.toLocaleString("id-ID")}). ` +
        "Pilih barang yang nilainya lebih dekat.",
    );
  }
  if (topup < s.min || topup > s.max) {
    throw new Error(
      s.from === "a"
        ? `Barangmu lebih rendah — bayar selisih ${s.min.toLocaleString("id-ID")}–${s.max.toLocaleString("id-ID")}.`
        : `Permintaan selisih maksimal ${s.max.toLocaleString("id-ID")}.`,
    );
  }
  return topup === 0 ? null : s.from;
}

/**
 * Cadangan Keteng penerima selisih = biaya pengembalian dana ke pembayar bila tukar batal karena kesalahan penerima:
 * biaya transfer + biaya DOKU terbesar (QRIS/VA) atas tagihan pembayar (selisih + biaya transfer + jaminannya).
 * Hanya biaya nyata — bukan ganti rugi — jadi tidak bisa dipakai mencari untung.
 */
export function estimasiCadangan(selisih: number, jaminanPembayar: number): number {
  if (selisih <= 0) return 0;
  const tagihan = selisih + BIAYA_TRANSFER + Math.max(0, jaminanPembayar);
  const daftar = METODE_SELISIH.length ? METODE_SELISIH : METODE.filter((m) => m.grup === "va");
  const biayaMaks = Math.max(0, ...daftar.map((m) => rincianBayar(tagihan, m.kode).biaya));
  return BIAYA_TRANSFER + biayaMaks;
}

// ============================================================
// Waktu
// ============================================================

const JAM = 3600_000;
const WIB = 7 * JAM;

/**
 * Tenggat bayar: 12 jam setelah diterima. Bila jatuh antara 22.00–08.00 WIB, digeser ke 10.00 WIB
 * (orang sedang tidur — kesempatan bayar tidak boleh hilang).
 */
export function tenggatBayar(now: Date): Date {
  const t = new Date(now.getTime() + JAM_BAYAR * JAM);
  const lokal = new Date(t.getTime() + WIB); // jam dinding WIB dibaca lewat getUTC*
  const jam = lokal.getUTCHours();
  if (jam >= 8 && jam < 22) return t;
  const hari = new Date(Date.UTC(lokal.getUTCFullYear(), lokal.getUTCMonth(), lokal.getUTCDate() + (jam >= 22 ? 1 : 0), 10));
  return new Date(hari.getTime() - WIB);
}

/** Tambah n hari kerja (Senin–Jumat, WIB). Libur nasional belum dihitung. */
export function tambahHariKerja(dari: Date, n: number): Date {
  let t = dari.getTime();
  let sisa = n;
  while (sisa > 0) {
    t += 24 * JAM;
    const hari = new Date(t + WIB).getUTCDay();
    if (hari !== 0 && hari !== 6) sisa--;
  }
  return new Date(t);
}

// ============================================================
// Kewajiban setelah tawaran diterima
// ============================================================

export type DealUang = {
  topup_from: string | null;
  selisih_uang: number;
  biaya_transfer: number;
  cadangan: number;
  fee_a: number;
  fee_b: number;
  deposit_a: number;
  deposit_b: number;
  ongkir_a: number; // ongkir paket yang diterima A (dibayar A)
  ongkir_b: number;
  setor_a_at: Date | string | null;
  setor_b_at: Date | string | null;
};

export const pembayarSelisih = (d: Pick<DealUang, "topup_from" | "selisih_uang">): Pihak | null =>
  d.selisih_uang > 0 && (d.topup_from === "a" || d.topup_from === "b") ? d.topup_from : null;

export const penerimaSelisih = (d: Pick<DealUang, "topup_from" | "selisih_uang">): Pihak | null => {
  const p = pembayarSelisih(d);
  return p ? lawanDari(p) : null;
};

/** Keteng jaminan pihak p: bea + deposit + ongkir yang ia terima + cadangan (bila ia penerima selisih). */
export function jaminanKeteng(d: DealUang, p: Pihak): number {
  const r = penerimaSelisih(d);
  return (p === "a" ? d.fee_a + d.deposit_a + d.ongkir_a : d.fee_b + d.deposit_b + d.ongkir_b) + (r === p ? d.cadangan : 0);
}

/** Uang yang dibayar pihak p lewat DOKU (selisih + biaya transfer pencairan), 0 bila bukan pembayar. */
export function uangSetor(d: DealUang, p: Pihak): number {
  return pembayarSelisih(d) === p ? d.selisih_uang + d.biaya_transfer : 0;
}

/**
 * Siapa yang sekarang wajib menyetor. B menahan jaminannya saat menerima. Lalu A menyetor (jaminan + selisih bila
 * ia pembayar). Bila B pembayar selisih, B membayar SETELAH A (penerima selisih) menahan cadangannya — supaya
 * biaya pengembalian dana selalu sudah dijamin pihak yang mungkin bersalah sebelum uang masuk.
 */
export function giliranSetor(d: Pick<DealUang, "setor_a_at" | "setor_b_at">): Pihak | null {
  if (!d.setor_a_at) return "a";
  if (!d.setor_b_at) return "b";
  return null;
}

// ============================================================
// Titik Aman COD
// ============================================================

/** Titik Aman COD: tempat umum, terang, ramai/ber-CCTV. Bukan alamat rumah. */
export const TITIK_AMAN = [
  { key: "minimarket", label: "Minimarket (depan kasir / CCTV)" },
  { key: "polisi", label: "Kantor / pos polisi" },
  { key: "kedai", label: "Kedai kopi / rumah makan ramai" },
  { key: "mal", label: "Mal / pusat perbelanjaan" },
  { key: "stasiun", label: "Stasiun / terminal" },
  { key: "ibadah", label: "Halaman rumah ibadah besar" },
] as const;

export function titikAmanLabel(key: string | null | undefined): string | null {
  return TITIK_AMAN.find((t) => t.key === key)?.label ?? null;
}

// ============================================================
// State machine
// ============================================================

export type DealStatus =
  | "proposed"
  | "menunggu_bayar"
  | "agreed"
  | "dikirim"
  | "diterima"
  | "done"
  | "rejected"
  | "cancelled"
  | "expired"
  | "disputed"
  | "resolved";

export type Aktor = Pihak | "admin" | "system";

export type Peristiwa =
  | "terima" // B menerima tawaran → menunggu pembayaran
  | "tolak" // B menolak
  | "tarik" // A menarik tawaran
  | "setor" // pihak menyetor jaminan / membayar selisih
  | "batal_menunggu" // salah satu mundur sebelum semua lunas (pihak yang mundur = bersalah)
  | "pindai" // COD: salah satu memindai kode pihak lain
  | "batal_di_tempat" // COD: salah satu membatalkan saat/sebelum ketemu
  | "bayar_ongkir" // Kirim (alur lama v2): pihak melunasi ongkir
  | "batal_sebelum_kirim" // Kirim: salah satu membatalkan sebelum paket dibuat
  | "paket" // Kirim: pembaruan status paket (webhook/sistem)
  | "konfirmasi" // Kirim: pihak menyatakan barang diterima & sesuai
  | "sengketa" // salah satu mengajukan ke Syahbandar
  | "kedaluwarsa" // cron
  | "putus"; // admin memutus sengketa

const ATURAN: Record<Peristiwa, { dari: DealStatus[]; aktor: Aktor[]; mode?: ModeTukar }> = {
  terima: { dari: ["proposed"], aktor: ["b"] },
  tolak: { dari: ["proposed"], aktor: ["b"] },
  tarik: { dari: ["proposed"], aktor: ["a"] },
  setor: { dari: ["menunggu_bayar"], aktor: ["a", "b"] },
  batal_menunggu: { dari: ["menunggu_bayar"], aktor: ["a", "b"] },
  pindai: { dari: ["agreed"], aktor: ["a", "b"], mode: "cod" },
  batal_di_tempat: { dari: ["agreed"], aktor: ["a", "b"], mode: "cod" },
  bayar_ongkir: { dari: ["agreed"], aktor: ["a", "b"], mode: "kirim" },
  batal_sebelum_kirim: { dari: ["agreed"], aktor: ["a", "b"], mode: "kirim" },
  paket: { dari: ["agreed", "dikirim", "diterima"], aktor: ["system"], mode: "kirim" },
  konfirmasi: { dari: ["diterima"], aktor: ["a", "b", "system"], mode: "kirim" },
  sengketa: { dari: ["agreed", "dikirim", "diterima"], aktor: ["a", "b", "system"] },
  kedaluwarsa: { dari: ["proposed", "menunggu_bayar", "agreed"], aktor: ["system"] },
  putus: { dari: ["disputed"], aktor: ["admin"] },
};

/** Lempar error bila peristiwa tidak sah untuk status, aktor & mode ini. */
export function pastikanBoleh(status: string, aktor: Aktor, ev: Peristiwa, mode: string = "cod"): void {
  const r = ATURAN[ev];
  if (!r.aktor.includes(aktor)) throw new Error("Kamu tidak berhak melakukan ini pada tawaran ini.");
  if (r.mode && r.mode !== mode) throw new Error("Aksi ini tidak berlaku untuk mode tukar ini.");
  if (!r.dari.includes(status as DealStatus)) throw new Error(`Tidak bisa: tawaran berstatus ${labelStatus(status)}.`);
}

export function bolehkah(status: string, aktor: Aktor, ev: Peristiwa, mode: string = "cod"): boolean {
  try {
    pastikanBoleh(status, aktor, ev, mode);
    return true;
  } catch {
    return false;
  }
}

const LABEL: Record<DealStatus, string> = {
  proposed: "menunggu jawaban",
  menunggu_bayar: "menunggu pembayaran",
  agreed: "sepakat",
  dikirim: "paket dalam perjalanan",
  diterima: "paket sampai — konfirmasi",
  done: "selesai",
  rejected: "ditolak",
  cancelled: "dibatalkan",
  expired: "kedaluwarsa",
  disputed: "di Syahbandar",
  resolved: "diputus Syahbandar",
};

export function labelStatus(s: string): string {
  return LABEL[s as DealStatus] ?? s;
}

export const STATUS_AKHIR: DealStatus[] = ["done", "rejected", "cancelled", "expired", "resolved"];
/** Status yang mengunci kedua barang (tidak bisa ditawar/diterima tawaran lain). */
export const STATUS_KUNCI: DealStatus[] = ["menunggu_bayar", "agreed", "dikirim", "diterima", "disputed"];
