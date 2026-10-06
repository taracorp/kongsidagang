// Isi Pundi — paket & nominal. Dipakai server (pundi.ts) & client (kartu Isi Pundi). 1 Keteng = Rp 1.
// Keteng tidak dapat diuangkan kembali.
//
// - Paket hemat: nominal kecil berbonus (mendorong isi di muka).
// - Nominal favorit: pilihan cepat untuk kebutuhan besar (mis. menutup selisih Tukar Guling), tanpa bonus.
// - Nominal lain: bebas, TOPUP_MIN–TOPUP_MAX, kelipatan Rp 1.000.

export type TopupPackage = {
  id: string;
  name: string;
  price: number; // rupiah yang dibayar
  keteng: number; // Keteng yang masuk Pundi (termasuk bonus)
};

export const TOPUP_PACKAGES: TopupPackage[] = [
  { id: "eceran", name: "Eceran", price: 10_000, keteng: 10_000 },
  { id: "pemula", name: "Pemula", price: 25_000, keteng: 25_500 },
  { id: "pedagang", name: "Pedagang", price: 50_000, keteng: 52_000 },
  { id: "saudagar", name: "Saudagar", price: 100_000, keteng: 106_000 },
  { id: "juragan", name: "Juragan", price: 250_000, keteng: 270_000 },
];

export const NOMINAL_FAVORIT = [500_000, 1_000_000, 2_000_000, 5_000_000];
export const TOPUP_MIN = 10_000;
export const TOPUP_MAX = 50_000_000;
export const TOPUP_KELIPATAN = 1_000;

export function findPackage(id: string): TopupPackage | undefined {
  return TOPUP_PACKAGES.find((p) => p.id === id);
}

export type RincianIsi = { packageId: string; name: string; price: number; keteng: number };

/**
 * Terjemahkan pilihan Isi Pundi: id paket ("pedagang") atau nominal rupiah ("1500000").
 * Lempar error bila tidak sah — dipakai server sebagai validasi utama.
 */
export function rincianIsi(pilihan: string): RincianIsi {
  const pkg = findPackage(pilihan);
  if (pkg) return { packageId: pkg.id, name: pkg.name, price: pkg.price, keteng: pkg.keteng };
  const n = Number(String(pilihan).replace(/\D/g, ""));
  if (!Number.isInteger(n) || n <= 0) throw new Error("Pilih paket atau isi nominal.");
  if (n < TOPUP_MIN) throw new Error(`Nominal minimal Rp ${TOPUP_MIN.toLocaleString("id-ID")}.`);
  if (n > TOPUP_MAX) throw new Error(`Nominal maksimal Rp ${TOPUP_MAX.toLocaleString("id-ID")} per transaksi.`);
  if (n % TOPUP_KELIPATAN !== 0) throw new Error("Nominal harus kelipatan Rp 1.000.");
  return { packageId: "nominal", name: `Rp ${n.toLocaleString("id-ID")}`, price: n, keteng: n };
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
