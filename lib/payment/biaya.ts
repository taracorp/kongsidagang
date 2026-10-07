// Biaya pembayaran DOKU per metode + platform fee Kongsi. Fungsi murni: dipakai server (tagihan)
// dan browser (tampilan). Sumber tarif: https://www.doku.com/en-us/pricing (Okt 2026), belum termasuk PPN.
// Kalau kontrak DOKU Anda berbeda, ubah angka di METODE saja.
//
// Prinsip (keputusan Tara, 7 Okt 2026):
// - Biaya DOKU ditanggung pembeli, sesuai metode yang ia pilih (termasuk PPN 11% atas biaya DOKU).
// - Platform fee flat per transaksi belanja = pendapatan Kongsi (menutup biaya setoran ke lapak + untung tipis).
// - Isi Pundi (Keteng, khusus Tukar Guling): hanya biaya DOKU, tanpa platform fee, tanpa bonus.

/** PPN efektif 11% (tarif 12% × DPP 11/12) atas biaya layanan DOKU. */
export const PPN = 0.11;

/** Platform fee belanja (Rupiah, sebelum PPN). */
export const PLATFORM_FEE = 4_000;

export type GrupMetode = "qris" | "va" | "ewallet" | "kartu";
export type Metode = {
  kode: string; // nilai DOKU Checkout `payment.payment_method_types`
  nama: string;
  grup: GrupMetode;
  persen: number; // MDR (desimal), sebelum PPN
  flat: number; // Rupiah per transaksi, sebelum PPN
};

export const METODE: Metode[] = [
  { kode: "QRIS", nama: "QRIS (semua e-wallet & m-banking)", grup: "qris", persen: 0.007, flat: 0 },
  { kode: "VIRTUAL_ACCOUNT_BCA", nama: "VA BCA", grup: "va", persen: 0, flat: 4_500 },
  { kode: "VIRTUAL_ACCOUNT_BANK_MANDIRI", nama: "VA Mandiri", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BRI", nama: "VA BRI", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BNI", nama: "VA BNI", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI", nama: "VA BSI", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BANK_PERMATA", nama: "VA Permata", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BANK_CIMB", nama: "VA CIMB Niaga", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BANK_DANAMON", nama: "VA Danamon", grup: "va", persen: 0, flat: 4_000 },
  { kode: "VIRTUAL_ACCOUNT_BTN", nama: "VA BTN", grup: "va", persen: 0, flat: 4_000 },
  { kode: "EMONEY_DANA", nama: "DANA", grup: "ewallet", persen: 0.015, flat: 0 },
  { kode: "EMONEY_OVO", nama: "OVO", grup: "ewallet", persen: 0.0318, flat: 0 },
  { kode: "EMONEY_SHOPEEPAY", nama: "ShopeePay", grup: "ewallet", persen: 0.04, flat: 0 },
  { kode: "CREDIT_CARD", nama: "Kartu kredit / debit (Visa, Mastercard, JCB)", grup: "kartu", persen: 0.028, flat: 2_000 },
];

export const NAMA_GRUP: Record<GrupMetode, string> = {
  qris: "QRIS",
  va: "Transfer bank (Virtual Account)",
  ewallet: "E-wallet",
  kartu: "Kartu",
};

export function cariMetode(kode: string): Metode {
  const m = METODE.find((x) => x.kode === kode);
  if (!m) throw new Error("Pilih metode pembayaran.");
  return m;
}

/** Potongan DOKU (termasuk PPN) atas nominal yang dibayar pembeli. */
export function potonganDoku(total: number, m: Metode): number {
  return Math.ceil((total * m.persen + m.flat) * (1 + PPN));
}

/**
 * Total yang harus dibayar agar setelah dipotong DOKU, yang diterima Kongsi = `neto`.
 * Biaya persen dihitung DOKU dari total (bukan dari neto), jadi dihitung naik (gross-up),
 * lalu dibulatkan ke atas ke Rp100.
 */
export function rincianBayar(neto: number, kode: string): { total: number; biaya: number } {
  const m = cariMetode(kode);
  let total = Math.ceil((neto + m.flat * (1 + PPN)) / (1 - m.persen * (1 + PPN)) / 100) * 100;
  while (total - potonganDoku(total, m) < neto) total += 100;
  return { total, biaya: total - neto };
}

/** Platform fee + PPN-nya (PPN hanya bila Kongsi sudah PKP: env KONGSI_PKP=true). */
export function platformFee(pkp: boolean): { fee: number; ppn: number; total: number } {
  const ppn = pkp ? Math.ceil(PLATFORM_FEE * PPN) : 0;
  return { fee: PLATFORM_FEE, ppn, total: PLATFORM_FEE + ppn };
}
