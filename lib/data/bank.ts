// Bank tujuan transfer pencairan (rekening user / lapak). Kode = nama singkat yang tampil di Kantor Kongsi.
export const BANK: { kode: string; nama: string }[] = [
  { kode: "BCA", nama: "BCA" },
  { kode: "MANDIRI", nama: "Bank Mandiri" },
  { kode: "BRI", nama: "BRI" },
  { kode: "BNI", nama: "BNI" },
  { kode: "BSI", nama: "Bank Syariah Indonesia (BSI)" },
  { kode: "BTN", nama: "BTN" },
  { kode: "CIMB", nama: "CIMB Niaga" },
  { kode: "PERMATA", nama: "Bank Permata" },
  { kode: "DANAMON", nama: "Bank Danamon" },
  { kode: "MUAMALAT", nama: "Bank Muamalat" },
  { kode: "OCBC", nama: "OCBC" },
  { kode: "PANIN", nama: "Panin Bank" },
  { kode: "BPD_DIY", nama: "BPD DIY" },
  { kode: "BJB", nama: "Bank BJB" },
  { kode: "JATENG", nama: "Bank Jateng" },
  { kode: "JATIM", nama: "Bank Jatim" },
  { kode: "DKI", nama: "Bank DKI" },
  { kode: "JAGO", nama: "Bank Jago" },
  { kode: "SEABANK", nama: "SeaBank" },
  { kode: "BLU", nama: "blu by BCA Digital" },
  { kode: "NEO", nama: "Bank Neo Commerce" },
  { kode: "ALLO", nama: "Allo Bank" },
];

export const namaBank = (kode: string | null | undefined) => BANK.find((b) => b.kode === kode)?.nama ?? kode ?? "";
