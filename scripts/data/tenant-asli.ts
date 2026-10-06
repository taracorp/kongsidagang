// Data tenant asli + bersih-bersih data contoh. Idempoten (aman dijalankan ulang).
//   Dev : npx tsx --conditions=react-server scripts/data/tenant-asli.ts
//   VPS : cd /var/www/kongsidagang && npx tsx --conditions=react-server scripts/data/tenant-asli.ts
//
// Sumber (diverifikasi dari HTML resmi, 6 Okt 2026):
//   - https://beautycenter.id/ (menu & harga) dan https://beautycenter.id/lokasi (10 cabang)
//   - https://drwprime.com/ (DRW Studio, pra-peluncuran: belum ada harga/alamat → lapak "segera hadir")
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// ------------------------------------------------------------
// Data contoh yang dihapus (persis sesuai prisma/seed.ts lama)
// ------------------------------------------------------------
const LOJI_CONTOH = [
  "loji-sari-ayu",
  "loji-glow-nusantara",
  "loji-rempah-timur",
  "loji-kain-batik",
  "loji-kopi-rakyat",
  "loji-wangi-ratu",
  "loji-rumah-tangga",
];
const LELANG_CONTOH = ["🏨 Hotel Bintang 4 di Jogjakarta", "💆 Spa Mewah di Ubud", "🍽️ Fine Dining untuk 2"];
const BARANG_TUKAR_CONTOH = [
  "Sepatu Lari (jarang dipakai)",
  "Buku Novel (10 judul)",
  "Kamera Analog Jadul",
  "Tanaman Monstera",
  "Jam Tangan Kulit",
  "Gitar Akustik",
];
const ARTIKEL_CONTOH = [
  "cara-menang-lelang",
  "loji-kopi-rakyat-naik-kelas",
  "rempah-lebih-mahal-dari-emas",
  "jadwal-obral-akbar",
  "etika-barter",
];

// ------------------------------------------------------------
// Beauty Center DRW Skincare
// ------------------------------------------------------------
const BC_CABANG: { name: string; city: string; address: string }[] = [
  { name: "DRW Beauty Center Jakal", city: "Sleman", address: "Jl. Kaliurang Km.14, RW 5, Lodadi, Umbulmartani, Sleman, Yogyakarta, 55581" },
  { name: "DRW Beauty Center Parangtritis", city: "Kota Yogyakarta", address: "Jl. Parangtritis 92 Yogyakarta RT 055 RW 015 Mantrijeron, Kota Yogyakarta" },
  { name: "DRW Beauty Center Kotagede", city: "Kota Yogyakarta", address: "Jalan Ngeksigondo No. 12 RT 011 RW 003 Prenggan, Kotagede, Yogyakarta" },
  { name: "DRW Beauty Center Wates", city: "Kulon Progo", address: "Jl. Diponegoro, Driyan, Wates, Kec. Wates Kab. Kulon Progo, DIY 55651" },
  { name: "DRW Beauty Center Prambanan", city: "Klaten", address: "Jl. Manisrenggo, Desa Tlogo, Prambanan, Kabupaten Klaten, Provinsi Jawa Tengah" },
  { name: "DRW Beauty Center Tajem", city: "Sleman", address: "Jl. Raya Tajem No. 1, Denokan, Maguwoharjo Depok, Sleman, DIY 55282" },
  { name: "DRW Beauty Center Godean", city: "Sleman", address: "Jl. Godean Km. 5 Kajor Nogotirto Gamping, Sleman" },
  { name: "Rumtik DRW Skincare Rajawali", city: "Sleman", address: "Jl. Rajawali Raya No.86, Manukan, Condongcatur Depok, Kabupaten Sleman, DIY" },
  { name: "DRW Beauty Center Bantul", city: "Bantul", address: "Jl. Jenderal Sudirman Dusun Depok Gandekan Bantul" },
  { name: "DRW Beauty Center Muntilan", city: "Magelang", address: "Jl. Pemuda No. 47 RT 005 RW 002 Desa Sedayu Kec. Muntilan, Kab. Magelang" },
];

type Menu = { nama: string; harga: number; kategori: string; tags: string[]; etalase?: boolean };
const SIG = "Signature Treatment";
const ACNE = "Velvet Acne Bloom";
const GLOW = "Glimmer Glow";
const AGE = "Aura Ageless";
const PIG = "Lumi Pigment Radiant";
const HAIR = "Hair Treatment";

// Nama & harga persis menu resmi (huruf dirapikan; singkatan IPL/RF dipertahankan).
const BC_MENU: Menu[] = [
  { nama: "IPL Hair Removal Wajah", harga: 80_000, kategori: SIG, tags: ["bulu", "ipl"], etalase: true },
  { nama: "Facial Acne", harga: 125_000, kategori: SIG, tags: ["jerawat", "facial"], etalase: true },
  { nama: "Facial White", harga: 125_500, kategori: SIG, tags: ["glow", "facial"] },
  { nama: "IPL Acne", harga: 150_000, kategori: SIG, tags: ["jerawat", "ipl"] },
  { nama: "IPL Kumis", harga: 150_000, kategori: SIG, tags: ["bulu", "ipl"] },
  { nama: "IPL Pigmen", harga: 150_000, kategori: SIG, tags: ["flek", "ipl"] },
  { nama: "IPL Rejuvenation", harga: 150_000, kategori: SIG, tags: ["anti-aging", "glow", "ipl"] },
  { nama: "IPL Vaskular", harga: 150_000, kategori: SIG, tags: ["kemerahan", "ipl"] },
  { nama: "Acne Care Facial", harga: 192_000, kategori: ACNE, tags: ["jerawat", "facial"] },
  { nama: "Acne Detox & Anti Acne Facial", harga: 256_000, kategori: ACNE, tags: ["jerawat", "facial"] },
  { nama: "Acne Purify Facial", harga: 296_000, kategori: ACNE, tags: ["jerawat", "facial"] },
  { nama: "Acne Radiant Recovery Facial", harga: 180_000, kategori: ACNE, tags: ["jerawat", "facial"] },
  { nama: "Acne Ultimate Facial", harga: 288_000, kategori: ACNE, tags: ["jerawat", "facial"] },
  { nama: "Glow Spark Facial", harga: 192_000, kategori: GLOW, tags: ["glow", "facial"], etalase: true },
  { nama: "Glow Shine Facial", harga: 256_000, kategori: GLOW, tags: ["glow", "facial"] },
  { nama: "Glow Bloom Facial", harga: 272_000, kategori: GLOW, tags: ["glow", "facial"] },
  { nama: "Glow Booster Facial", harga: 296_000, kategori: GLOW, tags: ["glow", "facial"] },
  { nama: "Glow Luminance Facial", harga: 268_000, kategori: GLOW, tags: ["glow", "facial"] },
  { nama: "Ageless Oxy Lift RF Facial", harga: 220_000, kategori: AGE, tags: ["anti-aging", "facial"], etalase: true },
  { nama: "Ageless Smooth Revive Facial", harga: 264_000, kategori: AGE, tags: ["anti-aging", "facial"] },
  { nama: "Ageless Booster Facial", harga: 256_000, kategori: AGE, tags: ["anti-aging", "facial"] },
  { nama: "Ageless Deep Rejuvenate Facial", harga: 244_000, kategori: AGE, tags: ["anti-aging", "facial"] },
  { nama: "Ageless Glow Facial", harga: 288_000, kategori: AGE, tags: ["anti-aging", "glow", "facial"] },
  { nama: "Ageless Radiance Facial", harga: 280_000, kategori: AGE, tags: ["anti-aging", "facial"] },
  { nama: "Pigment Bright Facial", harga: 192_000, kategori: PIG, tags: ["flek", "facial"], etalase: true },
  { nama: "Pigment Fade Facial", harga: 256_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Pigment Deep Facial", harga: 228_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Pigment Booster Facial", harga: 296_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Pigment Flawless Tone Facial", harga: 268_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Pigment Radiant Facial", harga: 308_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Pigment Supreme Facial", harga: 180_000, kategori: PIG, tags: ["flek", "facial"] },
  { nama: "Anti Dandruff Hairspa", harga: 70_000, kategori: HAIR, tags: ["rambut"] },
  { nama: "Hairfall Hairspa", harga: 70_000, kategori: HAIR, tags: ["rambut"] },
  { nama: "Collagen Hairspa", harga: 70_000, kategori: HAIR, tags: ["rambut"] },
  { nama: "Keratin Hairmask", harga: 96_000, kategori: HAIR, tags: ["rambut"], etalase: true },
  { nama: "Wash and Dry", harga: 25_000, kategori: HAIR, tags: ["rambut"] },
  { nama: "Cuci Blow Catok", harga: 50_000, kategori: HAIR, tags: ["rambut"] },
  { nama: "Hair Styling", harga: 25_000, kategori: HAIR, tags: ["rambut"] },
];

const DESKRIPSI_KATEGORI: Record<string, string> = {
  [SIG]: "Bagian dari Signature Treatment Beauty Center DRW Skincare.",
  [ACNE]: "Rangkaian Velvet Acne Bloom — facial untuk kulit berjerawat.",
  [GLOW]: "Rangkaian Glimmer Glow — facial untuk kulit kusam.",
  [AGE]: "Rangkaian Aura Ageless — facial untuk tanda-tanda penuaan.",
  [PIG]: "Rangkaian Lumi Pigment Radiant — facial untuk flek & warna kulit tidak merata.",
  [HAIR]: "Hair Treatment di Beauty Center DRW Skincare.",
};

// ------------------------------------------------------------
// Artikel Kabar
// ------------------------------------------------------------
import { ARTIKEL } from "./artikel";

// ------------------------------------------------------------

async function simpanLogo(url: string, nama: string, uploadDir: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; KongsiDagang/1.0)" }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const kecil = await sharp(buf).resize({ width: 480, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    const rel = path.posix.join("lapak", `${nama}.png`);
    const abs = path.join(uploadDir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, kecil);
    return `/uploads/${rel}`;
  } catch (e) {
    console.warn(`  ! logo ${nama} gagal diunduh (${(e as Error).message}) — lapak tetap dibuat tanpa logo`);
    return null;
  }
}

async function main() {
  const { prisma } = await import("@/lib/db");
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./.uploads");

  // Pemilik lapak = akun Superadmin (produksi) atau admin seed (dev). Kosong → dikelola admin Kongsi.
  const emails = [...(process.env.SUPERADMIN_EMAILS ?? "").split(","), process.env.SEED_ADMIN_EMAIL ?? ""]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const owner = emails.length ? await prisma.user.findFirst({ where: { email: { in: emails } }, select: { id: true, email: true } }) : null;
  console.log(`Pemilik lapak: ${owner?.email ?? "(admin Kongsi, tanpa pemilik)"}`);

  // 1. Hapus data contoh
  const m = await prisma.merchant.deleteMany({ where: { slug: { in: LOJI_CONTOH } } });
  const pl = await prisma.priceListing.deleteMany({});
  const a = await prisma.auction.deleteMany({ where: { clue_category: { in: LELANG_CONTOH } } });
  const b = await prisma.barterItem.deleteMany({ where: { title: { in: BARANG_TUKAR_CONTOH } } });
  const ar = await prisma.article.deleteMany({ where: { slug: { in: ARTIKEL_CONTOH } } });
  console.log(`Hapus contoh: ${m.count} loji, ${pl.count} harga Neraca, ${a.count} lelang, ${b.count} barang tukar, ${ar.count} artikel`);

  // 2. Beauty Center DRW Skincare
  const bcLogo = await simpanLogo("https://beautycenter.id/logo_beautycenter_putih.png", "beauty-center-drw", uploadDir);
  const bcData = {
    name: "Beauty Center DRW Skincare",
    category: "Perawatan Wajah & Rambut",
    city: "Yogyakarta",
    tone: "indigo",
    is_sealed: true,
    status: "buka",
    is_active: true,
    owner_id: owner?.id ?? null,
    description:
      "Facial Berkualitas, Harga Bersahabat. Perawatan wajah profesional dengan pilihan treatment sesuai kebutuhan kulitmu — terapis profesional, higienis & steril, konsultasi gratis. 10 cabang di Yogyakarta & sekitarnya.",
    whatsapp: "0815-4290-8888",
    website: "https://beautycenter.id",
    hours: "Senin–Minggu 09.00–18.00",
    ...(bcLogo ? { logo_url: bcLogo } : {}),
  };
  const bc = await prisma.merchant.upsert({
    where: { slug: "beauty-center-drw-skincare" },
    create: { slug: "beauty-center-drw-skincare", ...bcData },
    update: bcData,
  });
  for (const [i, c] of BC_CABANG.entries()) {
    const ada = await prisma.merchantBranch.findFirst({ where: { merchant_id: bc.id, name: c.name } });
    if (ada) await prisma.merchantBranch.update({ where: { id: ada.id }, data: { ...c, sort: i, is_active: true } });
    else await prisma.merchantBranch.create({ data: { merchant_id: bc.id, ...c, sort: i } });
  }
  for (const [i, p] of BC_MENU.entries()) {
    const data = {
      price: p.harga,
      category: p.kategori,
      tags: p.tags,
      kind: "evoucher",
      valid_days: 90,
      is_featured: !!p.etalase,
      is_active: true,
      sort: i,
      tone: "indigo",
      description: DESKRIPSI_KATEGORI[p.kategori],
    };
    const ada = await prisma.merchantProduct.findFirst({ where: { merchant_id: bc.id, name: p.nama } });
    if (ada) await prisma.merchantProduct.update({ where: { id: ada.id }, data });
    else await prisma.merchantProduct.create({ data: { merchant_id: bc.id, name: p.nama, ...data } });
  }
  console.log(`Beauty Center: ${BC_CABANG.length} cabang, ${BC_MENU.length} e-voucher${bcLogo ? ", logo ✓" : ""}`);

  // 3. DRW Studio — segera hadir (belum ada harga/alamat resmi)
  const dsLogo = await simpanLogo("https://drwprime.com/assets/drw-studio-logo.png", "drw-studio", uploadDir);
  const dsData = {
    name: "DRW Studio",
    category: "Beauty & Wellness",
    city: null,
    tone: "sage",
    is_sealed: true,
    status: "segera",
    is_active: true,
    owner_id: owner?.id ?? null,
    description:
      "Kecantikan dalam ritmemu. Ruang untuk kembali pada dirimu — jelajahi pilihan treatment dan temukan sesi yang paling sesuai kebutuhanmu. Studio berada di luar Yogyakarta; kota, alamat, dan harga diumumkan setelah dikonfirmasi.",
    whatsapp: null,
    website: "https://drwprime.com",
    hours: null,
    ...(dsLogo ? { logo_url: dsLogo } : {}),
  };
  await prisma.merchant.upsert({ where: { slug: "drw-studio" }, create: { slug: "drw-studio", ...dsData }, update: dsData });
  console.log(`DRW Studio: segera hadir${dsLogo ? ", logo ✓" : ""}`);

  // 4. Artikel Kabar (terbit berurutan supaya urutan tampil stabil)
  const sekarang = Date.now();
  for (const [i, art] of ARTIKEL.entries()) {
    const data = { ...art, published_at: new Date(sekarang - i * 60_000) };
    await prisma.article.upsert({ where: { slug: art.slug }, create: data, update: { ...data, published_at: undefined } });
  }
  console.log(`Artikel: ${ARTIKEL.length} terbit`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
