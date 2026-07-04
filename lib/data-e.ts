import type { Tone } from "@/components/kongsi/ProdukCard";

export type NeracaRow = {
  rank: number;
  loji: string;
  sealed?: boolean;
  rating: number;
  price: number;
  cheapest?: boolean;
};

export const neracaProduk = "Serum Vitamin C 20ml";
export const neracaLapak = 18;

export const neracaRows: NeracaRow[] = [
  { rank: 1, loji: "Loji Sari Ayu", sealed: true, rating: 4.9, price: 89000, cheapest: true },
  { rank: 2, loji: "Loji Glow Nusantara", sealed: true, rating: 4.8, price: 92500 },
  { rank: 3, loji: "Loji Cantika", rating: 4.6, price: 95000 },
  { rank: 4, loji: "Loji Rupawan", rating: 4.5, price: 98000 },
  { rank: 5, loji: "Loji Ayu Lestari", rating: 4.4, price: 99900 },
  { rank: 6, loji: "Loji Damai Beauty", rating: 4.4, price: 102000 },
  { rank: 7, loji: "Loji Kirana", rating: 4.3, price: 105000 },
  { rank: 8, loji: "Loji Melati", rating: 4.1, price: 108500 },
  { rank: 9, loji: "Loji Pesona", rating: 4.0, price: 110000 },
  { rank: 10, loji: "Loji Anggun", rating: 3.9, price: 114000 },
];

export type BarterItem = {
  title: string;
  owner: string;
  city: string;
  estValue: number;
  want: string;
  tone: Tone;
};

export const barterItems: BarterItem[] = [
  { title: "Sepatu Lari (jarang dipakai)", owner: "Rani", city: "Sleman", estValue: 250000, want: "tas ransel / jam tangan", tone: "sage" },
  { title: "Buku Novel (10 judul)", owner: "Dimas", city: "Jogja", estValue: 180000, want: "skincare / parfum", tone: "beeswax" },
  { title: "Kamera Analog Jadul", owner: "Sasa", city: "Bantul", estValue: 400000, want: "headphone + tambahan keping", tone: "grenadine" },
  { title: "Tanaman Monstera", owner: "Bagus", city: "Sleman", estValue: 120000, want: "pot keramik / bibit", tone: "olive" },
  { title: "Jam Tangan Kulit", owner: "Tia", city: "Jogja", estValue: 300000, want: "sepatu / tas", tone: "indigo" },
  { title: "Gitar Akustik", owner: "Fajar", city: "Kulon Progo", estValue: 550000, want: "keyboard / mixer", tone: "grenadine-dark" },
];

export type Artikel = {
  slug: string;
  title: string;
  tag: string;
  excerpt: string;
  tone: Tone;
  body: string[];
};

export const artikel: Artikel[] = [
  {
    slug: "cara-menang-lelang",
    title: "Cara menang lelang tanpa buang-buang tebakan",
    tag: "Tips Belanja",
    tone: "indigo",
    excerpt:
      "Trik membaca harga normal, memahami selisih, dan kapan waktu paling pas menekan tombol submit di Balai Lelang.",
    body: [
      "Di Balai Lelang, kamu tidak menawar paling tinggi — kamu menebak harga yang paling dekat dengan harga set rahasia.",
      "Mulai dari harga normal sebagai jangkar, lalu perkirakan margin yang biasa diambil Kongsi.",
      "Simpan tebakan terbaikmu untuk babak final, saat semua angka disembunyikan.",
    ],
  },
  {
    slug: "loji-kopi-rakyat-naik-kelas",
    title: "Loji Kopi Rakyat: dari gerobak jadi bersegel",
    tag: "Cerita Saudagar",
    tone: "beeswax",
    excerpt: "Perjalanan satu saudagar kecil naik kelas.",
    body: [
      "Berawal dari gerobak keliling, Loji Kopi Rakyat kini menyandang Cap Segel.",
      "Konsistensi rasa dan pelayanan membuat pelanggan kembali menebus.",
    ],
  },
  {
    slug: "rempah-lebih-mahal-dari-emas",
    title: "5 rempah Nusantara yang dulu lebih mahal dari emas",
    tag: "Rempah",
    tone: "sage",
    excerpt: "Pala, cengkih, dan kawan-kawan.",
    body: [
      "Pala dari Banda pernah memicu pelayaran antarbenua.",
      "Cengkih, lada, kayu manis, dan kunyit melengkapi jalur rempah.",
    ],
  },
  {
    slug: "etika-barter",
    title: "Etika barter: biar tukar-menukar tetap adil",
    tag: "Tukar Guling",
    tone: "grenadine",
    excerpt: "Panduan menaksir nilai & menghindari sengketa.",
    body: [
      "Taksir nilai barang dengan jujur, dan foto kondisi apa adanya.",
      "Bila nilai timpang, seimbangkan dengan tambahan keping.",
    ],
  },
  {
    slug: "jadwal-obral-akbar",
    title: "Jadwal obral akbar bulan ini",
    tag: "Pekan Raya",
    tone: "olive",
    excerpt: "Loji mana yang ikut & kapan mulai.",
    body: ["Pekan Raya menghadirkan Obral Kilat serentak dari puluhan loji."],
  },
];

export function getArtikel(slug: string): Artikel | undefined {
  return artikel.find((a) => a.slug === slug);
}

export type JuruHasil = {
  name: string;
  shop: string;
  price: number;
  tone: Tone;
};

export const juruHasil: JuruHasil[] = [
  { name: "Sambal Roa Botolan", shop: "Loji Rempah Timur", price: 45000, tone: "grenadine" },
  { name: "Keripik Balado Pedas", shop: "Loji Damai", price: 32000, tone: "beeswax-dark" },
  { name: "Mie Cabe Level 5", shop: "Loji Kuliner", price: 28000, tone: "olive" },
];

export type LelangClue = {
  kategori: string;
  namaLoji: string;
  hargaNormal: number;
  fasilitas: string[];
};

export const lelangClue: LelangClue = {
  kategori: "🏨 Hotel Bintang 4 di Jogjakarta",
  namaLoji: "A•••••••",
  hargaNormal: 500000,
  fasilitas: [
    "Kamar Deluxe (2 dewasa)",
    "Sarapan untuk 2 orang",
    "Late check-out 14:00",
    "Free minibar",
  ],
};
