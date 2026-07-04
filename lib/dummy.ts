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

export type Merchant = {
  slug: string;
  name: string;
  category: string;
  rating: number;
  tone: Tone;
  sealed?: boolean;
  status: "buka" | "obral";
  city: string;
  tebusan: number;
  coverFrom: Tone;
  coverTo: Tone;
  flashSale?: string;
  products: Produk[];
};

const kecantikan: Produk[] = [
  { name: "Serum Vitamin C 20ml", shop: "", price: 89000, oldPrice: 120000, tone: "sage" },
  { name: "Toner Beras 100ml", shop: "", price: 65000, oldPrice: 85000, tone: "beeswax" },
  { name: "Masker Kunyit 5pcs", shop: "", price: 45000, oldPrice: 60000, tone: "grenadine" },
  { name: "Sabun Rempah 3pcs", shop: "", price: 38000, oldPrice: 55000, tone: "olive" },
  { name: "Lulur Bali 250g", shop: "", price: 52000, oldPrice: 70000, tone: "indigo" },
  { name: "Minyak Zaitun 60ml", shop: "", price: 48000, oldPrice: 65000, tone: "sage" },
  { name: "Body Butter Kelapa", shop: "", price: 72000, oldPrice: 95000, tone: "beeswax-dark" },
  { name: "Face Mist Mawar", shop: "", price: 55000, oldPrice: 75000, tone: "grenadine-dark" },
];

const kopi: Produk[] = [
  { name: "Kopi Gayo 200g", shop: "", price: 62000, oldPrice: 80000, tone: "grenadine" },
  { name: "Kopi Toraja 200g", shop: "", price: 68000, oldPrice: 88000, tone: "olive" },
  { name: "Kopi Kintamani 200g", shop: "", price: 60000, oldPrice: 78000, tone: "beeswax" },
  { name: "Drip Bag 10pcs", shop: "", price: 45000, oldPrice: 55000, tone: "sage" },
];

export const merchants: Merchant[] = [
  {
    slug: "loji-sari-ayu",
    name: "Loji Sari Ayu",
    category: "Kecantikan & Rempah",
    rating: 4.9,
    tone: "grenadine",
    sealed: true,
    status: "obral",
    city: "Yogyakarta",
    tebusan: 1284,
    coverFrom: "grenadine",
    coverTo: "beeswax-dark",
    flashSale: "03:14:22",
    products: kecantikan,
  },
  {
    slug: "loji-glow-nusantara",
    name: "Loji Glow Nusantara",
    category: "Skincare",
    rating: 4.8,
    tone: "indigo",
    sealed: true,
    status: "buka",
    city: "Bandung",
    tebusan: 872,
    coverFrom: "indigo",
    coverTo: "sage",
    products: kecantikan.slice(0, 6),
  },
  {
    slug: "loji-rempah-timur",
    name: "Loji Rempah Timur",
    category: "Bumbu & Herbal",
    rating: 4.6,
    tone: "olive",
    status: "buka",
    city: "Makassar",
    tebusan: 540,
    coverFrom: "olive",
    coverTo: "beeswax",
    products: kopi,
  },
  {
    slug: "loji-kain-batik",
    name: "Loji Kain Batik",
    category: "Wastra & Busana",
    rating: 4.9,
    tone: "beeswax-dark",
    sealed: true,
    status: "obral",
    city: "Solo",
    tebusan: 1580,
    coverFrom: "beeswax-dark",
    coverTo: "grenadine",
    flashSale: "05:41:09",
    products: [
      { name: "Batik Tulis Sogan", shop: "", price: 245000, oldPrice: 320000, tone: "beeswax" },
      { name: "Kemeja Batik Pria", shop: "", price: 185000, oldPrice: 240000, tone: "indigo" },
      { name: "Selendang Lurik", shop: "", price: 95000, oldPrice: 130000, tone: "sage" },
      { name: "Kain Jarik 2m", shop: "", price: 120000, oldPrice: 160000, tone: "grenadine" },
    ],
  },
  {
    slug: "loji-kopi-rakyat",
    name: "Loji Kopi Rakyat",
    category: "Kuliner & Minuman",
    rating: 4.5,
    tone: "sage",
    status: "buka",
    city: "Aceh",
    tebusan: 410,
    coverFrom: "sage",
    coverTo: "olive",
    products: kopi,
  },
  {
    slug: "loji-wangi-ratu",
    name: "Loji Wangi Ratu",
    category: "Parfum & Aroma",
    rating: 4.7,
    tone: "grenadine-dark",
    sealed: true,
    status: "buka",
    city: "Surabaya",
    tebusan: 690,
    coverFrom: "grenadine-dark",
    coverTo: "beeswax",
    products: [
      { name: "Parfum Melati Ratu", shop: "", price: 135000, oldPrice: 175000, tone: "olive" },
      { name: "Face Mist Mawar", shop: "", price: 55000, oldPrice: 75000, tone: "grenadine" },
      { name: "Dupa Cendana 20pcs", shop: "", price: 40000, oldPrice: 55000, tone: "beeswax" },
      { name: "Minyak Nilam 30ml", shop: "", price: 78000, oldPrice: 98000, tone: "indigo" },
    ],
  },
];

export function getMerchant(slug: string): Merchant | undefined {
  return merchants.find((m) => m.slug === slug);
}

export const kategoriDagangan = [
  "Kecantikan & Rempah",
  "Skincare",
  "Kuliner & Minuman",
  "Wastra & Busana",
  "Parfum & Aroma",
  "Bumbu & Herbal",
  "Lainnya",
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
