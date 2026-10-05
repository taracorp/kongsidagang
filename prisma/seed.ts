// Seed data awal Kongsi Dagang ke Postgres via Prisma. Jalankan: npm run seed
// (dipanggil juga oleh `prisma migrate reset`). Data katalog sama dengan seed Supabase lama.
// Akun awal dari env: SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (jadi Ketua Kongsi),
// opsional SEED_TESTER_EMAIL + SEED_TESTER_PASSWORD (saldo & voucher contoh, untuk uji).
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type UserLevel } from "../lib/generated/prisma/client";

config({ path: ".env.local" });
config();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type P = { name: string; price: number; old_price: number; tone: string; tags?: string[] };

const kecantikan: P[] = [
  { name: "Serum Vitamin C 20ml", price: 89000, old_price: 120000, tone: "sage" },
  { name: "Toner Beras 100ml", price: 65000, old_price: 85000, tone: "beeswax" },
  { name: "Masker Kunyit 5pcs", price: 45000, old_price: 60000, tone: "grenadine" },
  { name: "Sabun Rempah 3pcs", price: 38000, old_price: 55000, tone: "olive" },
  { name: "Lulur Bali 250g", price: 52000, old_price: 70000, tone: "indigo" },
  { name: "Minyak Zaitun 60ml", price: 48000, old_price: 65000, tone: "sage" },
  { name: "Body Butter Kelapa", price: 72000, old_price: 95000, tone: "beeswax-dark" },
  { name: "Face Mist Mawar", price: 55000, old_price: 75000, tone: "grenadine-dark" },
];
const kopi: P[] = [
  { name: "Kopi Gayo 200g", price: 62000, old_price: 80000, tone: "grenadine" },
  { name: "Kopi Toraja 200g", price: 68000, old_price: 88000, tone: "olive" },
  { name: "Kopi Kintamani 200g", price: 60000, old_price: 78000, tone: "beeswax" },
  { name: "Drip Bag 10pcs", price: 45000, old_price: 55000, tone: "sage" },
];
const batik: P[] = [
  { name: "Batik Tulis Sogan", price: 245000, old_price: 320000, tone: "beeswax" },
  { name: "Kemeja Batik Pria", price: 185000, old_price: 240000, tone: "indigo" },
  { name: "Selendang Lurik", price: 95000, old_price: 130000, tone: "sage" },
  { name: "Kain Jarik 2m", price: 120000, old_price: 160000, tone: "grenadine" },
];
const parfum: P[] = [
  { name: "Parfum Melati Ratu", price: 135000, old_price: 175000, tone: "olive" },
  { name: "Face Mist Mawar", price: 55000, old_price: 75000, tone: "grenadine" },
  { name: "Dupa Cendana 20pcs", price: 40000, old_price: 55000, tone: "beeswax" },
  { name: "Minyak Nilam 30ml", price: 78000, old_price: 98000, tone: "indigo" },
];
const makanan: P[] = [
  { name: "Sambal Roa Botolan", price: 45000, old_price: 55000, tone: "grenadine", tags: ["makanan", "pedas"] },
  { name: "Keripik Balado Pedas", price: 32000, old_price: 40000, tone: "beeswax-dark", tags: ["makanan", "pedas"] },
  { name: "Mie Cabe Level 5", price: 22000, old_price: 30000, tone: "olive", tags: ["makanan", "pedas"] },
  { name: "Dodol Garut", price: 22000, old_price: 28000, tone: "beeswax", tags: ["makanan", "manis"] },
  { name: "Wingko Babat 10pcs", price: 24000, old_price: 30000, tone: "sage", tags: ["makanan", "manis"] },
  { name: "Rempeyek Kacang", price: 18000, old_price: 24000, tone: "olive", tags: ["makanan", "gurih"] },
  { name: "Abon Sapi Premium", price: 95000, old_price: 120000, tone: "grenadine-dark", tags: ["makanan", "gurih"] },
];
const perabot: P[] = [
  { name: "Vas Keramik Tembikar", price: 65000, old_price: 85000, tone: "sage", tags: ["perabot"] },
  { name: "Piring Rotan Set 4", price: 48000, old_price: 60000, tone: "olive", tags: ["perabot"] },
  { name: "Lampu Meja Anyaman", price: 120000, old_price: 150000, tone: "beeswax", tags: ["perabot"] },
  { name: "Toples Kaca 3pcs", price: 24000, old_price: 32000, tone: "indigo", tags: ["perabot"] },
];

// Tag kategori untuk Juru Tunjuk
kecantikan.forEach((p) => (p.tags = ["kecantikan"]));
kopi.forEach((p) => (p.tags = ["kuliner"]));
batik.forEach((p) => (p.tags = ["baju"]));
parfum.forEach((p) => (p.tags = ["kecantikan"]));

const merchants = [
  { slug: "loji-sari-ayu", name: "Loji Sari Ayu", category: "Kecantikan & Rempah", rating: 4.9, tone: "grenadine", cover_from: "grenadine", cover_to: "beeswax-dark", city: "Yogyakarta", is_sealed: true, status: "obral", tebusan_count: 1284, products: kecantikan },
  { slug: "loji-glow-nusantara", name: "Loji Glow Nusantara", category: "Skincare", rating: 4.8, tone: "indigo", cover_from: "indigo", cover_to: "sage", city: "Bandung", is_sealed: true, status: "buka", tebusan_count: 872, products: kecantikan.slice(0, 6) },
  { slug: "loji-rempah-timur", name: "Loji Rempah Timur", category: "Kuliner & Oleh-oleh", rating: 4.6, tone: "olive", cover_from: "olive", cover_to: "beeswax", city: "Makassar", is_sealed: false, status: "buka", tebusan_count: 540, products: makanan },
  { slug: "loji-kain-batik", name: "Loji Kain Batik", category: "Wastra & Busana", rating: 4.9, tone: "beeswax-dark", cover_from: "beeswax-dark", cover_to: "grenadine", city: "Solo", is_sealed: true, status: "obral", tebusan_count: 1580, products: batik },
  { slug: "loji-kopi-rakyat", name: "Loji Kopi Rakyat", category: "Kuliner & Minuman", rating: 4.5, tone: "sage", cover_from: "sage", cover_to: "olive", city: "Aceh", is_sealed: false, status: "buka", tebusan_count: 410, products: kopi },
  { slug: "loji-wangi-ratu", name: "Loji Wangi Ratu", category: "Parfum & Aroma", rating: 4.7, tone: "grenadine-dark", cover_from: "grenadine-dark", cover_to: "beeswax", city: "Surabaya", is_sealed: true, status: "buka", tebusan_count: 690, products: parfum },
  { slug: "loji-rumah-tangga", name: "Loji Rumah Tangga", category: "Perabot & Rumah", rating: 4.4, tone: "indigo", cover_from: "indigo", cover_to: "olive", city: "Jepara", is_sealed: false, status: "buka", tebusan_count: 320, products: perabot },
];

const articles = [
  { slug: "cara-menang-lelang", title: "Cara menang lelang tanpa buang-buang tebakan", tag: "Tips Belanja", cover_tone: "indigo", excerpt: "Trik membaca harga normal, memahami selisih, dan kapan waktu paling pas menekan tombol submit di Balai Lelang.", body: ["Di Balai Lelang, kamu tidak menawar paling tinggi — kamu menebak harga yang paling dekat dengan harga set rahasia.", "Mulai dari harga normal sebagai jangkar, lalu perkirakan margin yang biasa diambil Kongsi.", "Simpan tebakan terbaikmu untuk babak final, saat semua angka disembunyikan."] },
  { slug: "loji-kopi-rakyat-naik-kelas", title: "Loji Kopi Rakyat: dari gerobak jadi bersegel", tag: "Cerita Saudagar", cover_tone: "beeswax", excerpt: "Perjalanan satu saudagar kecil naik kelas.", body: ["Berawal dari gerobak keliling, Loji Kopi Rakyat kini menyandang Cap Segel.", "Konsistensi rasa dan pelayanan membuat pelanggan kembali menebus."] },
  { slug: "rempah-lebih-mahal-dari-emas", title: "5 rempah Nusantara yang dulu lebih mahal dari emas", tag: "Rempah", cover_tone: "sage", excerpt: "Pala, cengkih, dan kawan-kawan.", body: ["Pala dari Banda pernah memicu pelayaran antarbenua.", "Cengkih, lada, kayu manis, dan kunyit melengkapi jalur rempah."] },
  { slug: "etika-barter", title: "Etika barter: biar tukar-menukar tetap adil", tag: "Tukar Guling", cover_tone: "grenadine", excerpt: "Panduan menaksir nilai & menghindari sengketa.", body: ["Taksir nilai barang dengan jujur, dan foto kondisi apa adanya.", "Bila nilai timpang, seimbangkan dengan tambahan Keteng."] },
  { slug: "jadwal-obral-akbar", title: "Jadwal obral akbar bulan ini", tag: "Pekan Raya", cover_tone: "olive", excerpt: "Loji mana yang ikut & kapan mulai.", body: ["Pekan Raya menghadirkan Obral Kilat serentak dari puluhan loji."] },
];

const neraca = [
  { loji: "Loji Sari Ayu", sealed: true, rating: 4.9, price: 89000 },
  { loji: "Loji Glow Nusantara", sealed: true, rating: 4.8, price: 92500 },
  { loji: "Loji Cantika", sealed: false, rating: 4.6, price: 95000 },
  { loji: "Loji Rupawan", sealed: false, rating: 4.5, price: 98000 },
  { loji: "Loji Ayu Lestari", sealed: false, rating: 4.4, price: 99900 },
  { loji: "Loji Damai Beauty", sealed: false, rating: 4.4, price: 102000 },
  { loji: "Loji Kirana", sealed: false, rating: 4.3, price: 105000 },
  { loji: "Loji Melati", sealed: false, rating: 4.1, price: 108500 },
  { loji: "Loji Pesona", sealed: false, rating: 4.0, price: 110000 },
  { loji: "Loji Anggun", sealed: false, rating: 3.9, price: 114000 },
];

const barter = [
  { title: "Sepatu Lari (jarang dipakai)", est_value: 250000, want_text: "tas ransel / jam tangan", city: "Sleman", tone: "sage" },
  { title: "Buku Novel (10 judul)", est_value: 180000, want_text: "skincare / parfum", city: "Jogja", tone: "beeswax" },
  { title: "Kamera Analog Jadul", est_value: 400000, want_text: "headphone + tambahan keping", city: "Bantul", tone: "grenadine" },
  { title: "Tanaman Monstera", est_value: 120000, want_text: "pot keramik / bibit", city: "Sleman", tone: "olive" },
  { title: "Jam Tangan Kulit", est_value: 300000, want_text: "sepatu / tas", city: "Jogja", tone: "indigo" },
  { title: "Gitar Akustik", est_value: 550000, want_text: "keyboard / mixer", city: "Kulon Progo", tone: "grenadine-dark" },
];

const NERACA_KEY = "Serum Vitamin C 20ml";

const auctions = [
  {
    type: "reguler",
    clue_category: "🏨 Hotel Bintang 4 di Jogjakarta",
    clue_name_masked: "A•••••••",
    normal_price: 500000,
    facilities: [
      "Kamar Deluxe (2 dewasa)",
      "Sarapan untuk 2 orang",
      "Late check-out 14:00",
      "Free minibar",
    ],
    deal_price: 400000,
    set_price: 470000,
    status: "tebak",
    capacity: 10,
  },
  {
    type: "reguler",
    clue_category: "💆 Spa Mewah di Ubud",
    clue_name_masked: "A•••••••",
    normal_price: 450000,
    facilities: ["Body massage 90 menit", "Flower bath", "Welcome drink"],
    deal_price: 300000,
    set_price: 360000,
    status: "kumpul",
    capacity: 10,
  },
  {
    type: "vendu",
    clue_category: "🍽️ Fine Dining untuk 2",
    clue_name_masked: "K••••",
    normal_price: 500000,
    facilities: ["7-course dinner", "Wine pairing", "Meja privat"],
    deal_price: 320000,
    set_price: 400000,
    status: "kumpul",
    capacity: 8,
  },
];


/** Buat akun email+sandi bila belum ada (format Better Auth: user + account "credential"). */
async function ensureUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  return id;
}

async function provision(
  userId: string,
  name: string,
  opts: { level?: UserLevel; stamps?: number; balance?: number; total_spend?: number } = {},
) {
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, full_name: name, level: opts.level, stamps: opts.stamps, total_spend: opts.total_spend },
    update: { level: opts.level, stamps: opts.stamps, total_spend: opts.total_spend },
  });
  await prisma.wallet.upsert({
    where: { user_id: userId },
    create: { user_id: userId, balance: opts.balance ?? 0 },
    update: opts.balance != null ? { balance: opts.balance } : {},
  });
}

async function main() {
  console.log("Akun awal…");
  let adminId: string | null = null;
  const { SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_TESTER_EMAIL, SEED_TESTER_PASSWORD } =
    process.env;
  if (SEED_ADMIN_EMAIL && SEED_ADMIN_PASSWORD) {
    adminId = await ensureUser(SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, "Ketua Kongsi");
    await provision(adminId, "Ketua Kongsi");
    await prisma.staffRole.upsert({
      where: { user_id: adminId },
      create: { user_id: adminId, role: "ketua" },
      update: { role: "ketua" },
    });
    console.log(`  Ketua: ${SEED_ADMIN_EMAIL}`);
  } else {
    console.log("  (lewati admin — SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD belum diisi)");
  }

  let testerId: string | null = null;
  if (SEED_TESTER_EMAIL && SEED_TESTER_PASSWORD) {
    testerId = await ensureUser(SEED_TESTER_EMAIL, SEED_TESTER_PASSWORD, "Penguji");
    await provision(testerId, "Penguji", { level: "tuan_kecil", stamps: 7, balance: 1_250_000, total_spend: 1_000_000 });
    await prisma.voucher.deleteMany({ where: { user_id: testerId } });
    await prisma.voucher.createMany({
      data: [
        { user_id: testerId, title: "Hotel Artotel — Deluxe 1 malam", note: "Menang lelang · contoh", kind: "lelang" },
        { user_id: testerId, title: "Serum Vitamin C — Loji Sari Ayu", note: "Tebus neraca · contoh", kind: "neraca" },
      ],
    });
    console.log(`  Penguji: ${SEED_TESTER_EMAIL}`);
  }

  console.log("Loji & produk…");
  const idBySlug: Record<string, string> = {};
  for (const { products, ...m } of merchants) {
    const row = await prisma.merchant.upsert({
      where: { slug: m.slug },
      create: m,
      update: m,
    });
    idBySlug[m.slug] = row.id;
    await prisma.merchantProduct.deleteMany({ where: { merchant_id: row.id } });
    await prisma.merchantProduct.createMany({
      data: products.map((p) => ({ ...p, tags: p.tags ?? [], merchant_id: row.id })),
    });
  }

  console.log("Kabar…");
  for (const a of articles) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      create: { ...a, published_at: new Date() },
      update: a,
    });
  }

  console.log("Neraca…");
  await prisma.priceListing.deleteMany({ where: { product_key: NERACA_KEY } });
  await prisma.priceListing.createMany({
    data: neraca.map((n) => ({
      product_key: NERACA_KEY,
      source_type: "merchant",
      loji_name: n.loji,
      is_sealed: n.sealed,
      rating: n.rating,
      price: n.price,
      is_verified_price: n.sealed,
      merchant_id: idBySlug[n.loji.toLowerCase().replace(/\s+/g, "-")] ?? null,
    })),
  });

  console.log("Tukar Guling…");
  const owner = testerId ?? adminId;
  if (owner) {
    await prisma.barterItem.deleteMany({ where: { title: { in: barter.map((b) => b.title) } } });
    await prisma.barterItem.createMany({
      data: barter.map((b) => ({ ...b, user_id: owner, status: "aktif" })),
    });
  } else {
    console.log("  (lewati barter — belum ada akun)");
  }

  console.log("Lelang…");
  await prisma.auction.deleteMany();
  const now = Date.now();
  await prisma.auction.createMany({
    data: auctions.map((a) => ({
      ...a,
      starts_at: new Date(now),
      phase_ends_at: new Date(now + 60_000),
    })),
  });

  console.log("\n✓ Seed selesai.");
}

main()
  .catch((e) => {
    console.error("\n✗ Seed gagal:", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
