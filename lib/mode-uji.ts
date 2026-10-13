// Saklar mode uji (demo/tiruan). Di produksi (NODE_ENV=production) SELALU mati, kecuali instance uji yang
// sengaja mengizinkan lewat IZINKAN_MOCK=true. Mencegah Keteng/voucher gratis bila saklar terbawa ke produksi.
//   ENABLE_TOPUP_DEMO — Isi Pundi & belanja tanpa pembayaran
//   DOKU_MOCK         — halaman bayar tiruan (user bisa menandai lunas sendiri)
//   KIRIMINAJA_MOCK   — kurir tiruan (token webhook publik "tiruan")

export function mockDiizinkan(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.IZINKAN_MOCK === "true";
}

export type SaklarUji = "ENABLE_TOPUP_DEMO" | "DOKU_MOCK" | "KIRIMINAJA_MOCK";

/** true hanya bila saklar bernilai "true" DAN mode uji diizinkan di lingkungan ini. */
export function saklarUji(nama: SaklarUji): boolean {
  return process.env[nama] === "true" && mockDiizinkan();
}
