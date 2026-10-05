// Aturan Tukar Guling — fungsi murni (tanpa DB), dipakai server & client (kalkulator, label).

export const BEA_PERSEN = 0.1;
export const BEA_MAKS = 10_000;
export const JAM_COD = 72; // batas waktu ketemuan setelah sepakat
export const HARI_TAWARAN = 7; // tawaran tak dijawab kedaluwarsa
export const MAKS_GAGAL_PINDAI = 10;
export const JAM_BAYAR_ONGKIR = 12; // mode Kirim: kedua pihak melunasi ongkir setelah sepakat
export const JAM_KONFIRMASI = 48; // kedua paket sampai → konfirmasi otomatis setelah ini
export const JAM_PENAHANAN_SILANG = 48; // satu pihak sudah kirim, pihak lain belum → Syahbandar

export const DEPOSIT_PERSEN = 0.1;
export const DEPOSIT_MIN = 5_000;
export const DEPOSIT_MAKS = 200_000;

/** Deposit mode Kirim per pihak: 10% taksiran barang sendiri, min 5rb, maks 200rb. Kembali utuh saat selesai. */
export function depositKirim(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(DEPOSIT_MAKS, Math.max(DEPOSIT_MIN, Math.ceil(value * DEPOSIT_PERSEN)));
}

export type ModeTukar = "cod" | "kirim";

/** Bea Tukar per pihak: 10% taksiran barangnya sendiri, maks 10.000 Keteng. */
export function beaTukar(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(BEA_MAKS, Math.ceil(value * BEA_PERSEN));
}

export type Pihak = "a" | "b";

/**
 * Selisih nilai: pihak bernilai lebih rendah menambah Keteng.
 * A (pengaju) lebih rendah → A wajib menambah minimal selisih.
 * A lebih tinggi → A boleh meminta B menambah 0…selisih (A boleh merelakan).
 */
export function hitungSelisih(valueA: number, valueB: number) {
  const diff = Math.abs(valueA - valueB);
  if (diff === 0) return { from: null as Pihak | null, diff: 0, min: 0, max: 0 };
  if (valueA < valueB) return { from: "a" as Pihak, diff, min: diff, max: diff * 2 };
  return { from: "b" as Pihak, diff, min: 0, max: diff };
}

export function validasiTambah(valueA: number, valueB: number, topup: number): Pihak | null {
  const s = hitungSelisih(valueA, valueB);
  if (!Number.isInteger(topup) || topup < 0) throw new Error("Tambahan Keteng tidak valid.");
  if (s.from === null) {
    if (topup !== 0) throw new Error("Nilai sudah seimbang — tidak perlu tambah Keteng.");
    return null;
  }
  if (topup < s.min || topup > s.max) {
    throw new Error(
      s.from === "a"
        ? `Barangmu lebih rendah — tambah Keteng minimal ${s.min.toLocaleString("id-ID")}.`
        : `Permintaan tambah Keteng maksimal ${s.max.toLocaleString("id-ID")} (selisih nilai).`,
    );
  }
  return topup === 0 ? null : s.from;
}

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
  | "terima" // B menerima tawaran
  | "tolak" // B menolak
  | "tarik" // A menarik tawaran
  | "pindai" // COD: salah satu memindai kode pihak lain
  | "batal_di_tempat" // COD: salah satu membatalkan saat/sebelum ketemu
  | "bayar_ongkir" // Kirim: pihak melunasi ongkir barang yang ia terima
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
  pindai: { dari: ["agreed"], aktor: ["a", "b"], mode: "cod" },
  batal_di_tempat: { dari: ["agreed"], aktor: ["a", "b"], mode: "cod" },
  bayar_ongkir: { dari: ["agreed"], aktor: ["a", "b"], mode: "kirim" },
  batal_sebelum_kirim: { dari: ["agreed"], aktor: ["a", "b"], mode: "kirim" },
  paket: { dari: ["agreed", "dikirim", "diterima"], aktor: ["system"], mode: "kirim" },
  konfirmasi: { dari: ["diterima"], aktor: ["a", "b", "system"], mode: "kirim" },
  sengketa: { dari: ["agreed", "dikirim", "diterima"], aktor: ["a", "b", "system"] },
  kedaluwarsa: { dari: ["proposed", "agreed"], aktor: ["system"] },
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
