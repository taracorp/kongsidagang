// Paket Isi Pundi — dipakai server (pundi.ts) & client (kartu paket). 1 Keteng = Rp 1.
// Bonus mendorong isi lebih besar di muka. Keteng tidak dapat diuangkan kembali.

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

export function findPackage(id: string): TopupPackage | undefined {
  return TOPUP_PACKAGES.find((p) => p.id === id);
}
