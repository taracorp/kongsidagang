import type { Tone } from "@/components/kongsi/ProdukCard";

export type Produk = {
  name: string;
  shop: string;
  price: number;
  oldPrice?: number;
  tone: Tone;
};

export const etalaseKurasi: Produk[] = [
  {
    name: "Serum Vitamin C 20ml",
    shop: "Loji Sari Ayu",
    price: 89000,
    oldPrice: 120000,
    tone: "sage",
  },
  {
    name: "Kain Batik Tulis Sogan",
    shop: "Loji Kain Batik",
    price: 245000,
    oldPrice: 320000,
    tone: "beeswax",
  },
  {
    name: "Kopi Gayo 200g",
    shop: "Loji Kopi Rakyat",
    price: 62000,
    oldPrice: 80000,
    tone: "grenadine",
  },
  {
    name: "Parfum Melati Ratu",
    shop: "Loji Wangi Ratu",
    price: 135000,
    oldPrice: 175000,
    tone: "olive",
  },
  {
    name: "Madu Hutan 500ml",
    shop: "Loji Rempah Timur",
    price: 98000,
    oldPrice: 130000,
    tone: "indigo",
  },
];

export const pilihanUntukmu: Produk[] = [
  { name: "Toner Beras 100ml", shop: "Loji Glow Nusantara", price: 65000, tone: "sage" },
  { name: "Masker Kunyit 5pcs", shop: "Loji Sari Ayu", price: 45000, tone: "beeswax" },
  { name: "Lulur Bali 250g", shop: "Loji Cantika", price: 52000, tone: "grenadine" },
  { name: "Face Mist Mawar", shop: "Loji Wangi Ratu", price: 55000, tone: "olive" },
];

export type LelangAktif = {
  kategori: string;
  namaLoji: string;
  hargaNormal: number;
  mulaiDalam: string;
  peserta: number;
  kapasitas: number;
};

export const lelangAktif: LelangAktif = {
  kategori: "🏨 Hotel Bintang 4 di Jogjakarta",
  namaLoji: "A•••••••",
  hargaNormal: 500000,
  mulaiDalam: "08:42",
  peserta: 7,
  kapasitas: 10,
};
