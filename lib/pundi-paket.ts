// Isi Pundi (Keteng — khusus Tukar Guling). Fungsi murni: dipakai client & server.
// Sejak 7 Okt 2026 (keputusan Tara): TANPA bonus paket. Keteng yang masuk = nominal;
// pembeli membayar nominal + biaya DOKU sesuai metode (lib/payment/biaya.ts), tanpa platform fee.
// - Nominal cepat: tombol siap pakai.
// - Nominal lain: bebas, TOPUP_MIN–TOPUP_MAX, kelipatan Rp 1.000.

export const NOMINAL_CEPAT = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000];
export const TOPUP_MIN = 10_000;
export const TOPUP_MAX = 50_000_000;
export const TOPUP_KELIPATAN = 1_000;

/** Validasi nominal Isi Pundi → Keteng yang masuk (1:1). */
export function nominalIsi(pilihan: string | number): number {
  const n = Number(String(pilihan).replace(/\D/g, ""));
  if (!Number.isInteger(n) || n <= 0) throw new Error("Isi nominal.");
  if (n < TOPUP_MIN) throw new Error(`Nominal minimal Rp ${TOPUP_MIN.toLocaleString("id-ID")}.`);
  if (n > TOPUP_MAX) throw new Error(`Nominal maksimal Rp ${TOPUP_MAX.toLocaleString("id-ID")} per transaksi.`);
  if (n % TOPUP_KELIPATAN !== 0) throw new Error("Nominal harus kelipatan Rp 1.000.");
  return n;
}

/** Nominal yang disarankan untuk menutup kekurangan saldo (dibulatkan ke atas, dalam batas). */
export function saranIsi(kurang: number): number {
  if (!Number.isFinite(kurang) || kurang <= 0) return TOPUP_MIN;
  const naik = Math.ceil(kurang / TOPUP_KELIPATAN) * TOPUP_KELIPATAN;
  return Math.min(TOPUP_MAX, Math.max(TOPUP_MIN, naik));
}

/** Tautan ke Pakhuis dengan nominal Isi Pundi sudah terisi. */
export function tautanIsi(kurang: number): string {
  return `/pakhuis?isi_nominal=${saranIsi(kurang)}#isi-pundi`;
}

/**
 * Keteng yang dibeli lewat Bayar Langsung (Tukar Guling).
 * - "penuh": seluruh kebutuhan.
 * - "kurang": kebutuhan dikurangi saldo.
 * Keduanya dibulatkan ke atas ke Rp1.000 dan minimal Rp10.000; kelebihannya tetap jadi Keteng di Pundi.
 */
export function nominalLangsung(kebutuhan: number, saldo: number, cara: "kurang" | "penuh"): number {
  const dasar = cara === "penuh" ? kebutuhan : kebutuhan - Math.max(0, saldo);
  if (dasar <= 0) return 0;
  return saranIsi(dasar);
}
