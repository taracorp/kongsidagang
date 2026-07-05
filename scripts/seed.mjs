// Seed data awal Kongsi Dagang ke Supabase (via REST + secret key).
// Baca kredensial dari .env.local. Jalankan sekali: npm run seed
import { readFileSync } from "node:fs";

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // ignore
  }
  return env;
}

const env = loadEnv();
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY;
if (!URL_BASE || !SECRET) {
  console.error("Butuh NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SECRET_KEY di .env.local");
  process.exit(1);
}

const H = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

async function rest(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...H, Prefer: prefer } : H,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const kecantikan = [
  { name: "Serum Vitamin C 20ml", price: 89000, old_price: 120000, tone: "sage" },
  { name: "Toner Beras 100ml", price: 65000, old_price: 85000, tone: "beeswax" },
  { name: "Masker Kunyit 5pcs", price: 45000, old_price: 60000, tone: "grenadine" },
  { name: "Sabun Rempah 3pcs", price: 38000, old_price: 55000, tone: "olive" },
  { name: "Lulur Bali 250g", price: 52000, old_price: 70000, tone: "indigo" },
  { name: "Minyak Zaitun 60ml", price: 48000, old_price: 65000, tone: "sage" },
  { name: "Body Butter Kelapa", price: 72000, old_price: 95000, tone: "beeswax-dark" },
  { name: "Face Mist Mawar", price: 55000, old_price: 75000, tone: "grenadine-dark" },
];
const kopi = [
  { name: "Kopi Gayo 200g", price: 62000, old_price: 80000, tone: "grenadine" },
  { name: "Kopi Toraja 200g", price: 68000, old_price: 88000, tone: "olive" },
  { name: "Kopi Kintamani 200g", price: 60000, old_price: 78000, tone: "beeswax" },
  { name: "Drip Bag 10pcs", price: 45000, old_price: 55000, tone: "sage" },
];
const batik = [
  { name: "Batik Tulis Sogan", price: 245000, old_price: 320000, tone: "beeswax" },
  { name: "Kemeja Batik Pria", price: 185000, old_price: 240000, tone: "indigo" },
  { name: "Selendang Lurik", price: 95000, old_price: 130000, tone: "sage" },
  { name: "Kain Jarik 2m", price: 120000, old_price: 160000, tone: "grenadine" },
];
const parfum = [
  { name: "Parfum Melati Ratu", price: 135000, old_price: 175000, tone: "olive" },
  { name: "Face Mist Mawar", price: 55000, old_price: 75000, tone: "grenadine" },
  { name: "Dupa Cendana 20pcs", price: 40000, old_price: 55000, tone: "beeswax" },
  { name: "Minyak Nilam 30ml", price: 78000, old_price: 98000, tone: "indigo" },
];

const merchants = [
  { slug: "loji-sari-ayu", name: "Loji Sari Ayu", category: "Kecantikan & Rempah", rating: 4.9, tone: "grenadine", cover_from: "grenadine", cover_to: "beeswax-dark", city: "Yogyakarta", is_sealed: true, status: "obral", tebusan_count: 1284, products: kecantikan },
  { slug: "loji-glow-nusantara", name: "Loji Glow Nusantara", category: "Skincare", rating: 4.8, tone: "indigo", cover_from: "indigo", cover_to: "sage", city: "Bandung", is_sealed: true, status: "buka", tebusan_count: 872, products: kecantikan.slice(0, 6) },
  { slug: "loji-rempah-timur", name: "Loji Rempah Timur", category: "Bumbu & Herbal", rating: 4.6, tone: "olive", cover_from: "olive", cover_to: "beeswax", city: "Makassar", is_sealed: false, status: "buka", tebusan_count: 540, products: kopi },
  { slug: "loji-kain-batik", name: "Loji Kain Batik", category: "Wastra & Busana", rating: 4.9, tone: "beeswax-dark", cover_from: "beeswax-dark", cover_to: "grenadine", city: "Solo", is_sealed: true, status: "obral", tebusan_count: 1580, products: batik },
  { slug: "loji-kopi-rakyat", name: "Loji Kopi Rakyat", category: "Kuliner & Minuman", rating: 4.5, tone: "sage", cover_from: "sage", cover_to: "olive", city: "Aceh", is_sealed: false, status: "buka", tebusan_count: 410, products: kopi },
  { slug: "loji-wangi-ratu", name: "Loji Wangi Ratu", category: "Parfum & Aroma", rating: 4.7, tone: "grenadine-dark", cover_from: "grenadine-dark", cover_to: "beeswax", city: "Surabaya", is_sealed: true, status: "buka", tebusan_count: 690, products: parfum },
];

const articles = [
  { slug: "cara-menang-lelang", title: "Cara menang lelang tanpa buang-buang tebakan", tag: "Tips Belanja", cover_tone: "indigo", excerpt: "Trik membaca harga normal, memahami selisih, dan kapan waktu paling pas menekan tombol submit di Balai Lelang.", body: ["Di Balai Lelang, kamu tidak menawar paling tinggi — kamu menebak harga yang paling dekat dengan harga set rahasia.", "Mulai dari harga normal sebagai jangkar, lalu perkirakan margin yang biasa diambil Kongsi.", "Simpan tebakan terbaikmu untuk babak final, saat semua angka disembunyikan."] },
  { slug: "loji-kopi-rakyat-naik-kelas", title: "Loji Kopi Rakyat: dari gerobak jadi bersegel", tag: "Cerita Saudagar", cover_tone: "beeswax", excerpt: "Perjalanan satu saudagar kecil naik kelas.", body: ["Berawal dari gerobak keliling, Loji Kopi Rakyat kini menyandang Cap Segel.", "Konsistensi rasa dan pelayanan membuat pelanggan kembali menebus."] },
  { slug: "rempah-lebih-mahal-dari-emas", title: "5 rempah Nusantara yang dulu lebih mahal dari emas", tag: "Rempah", cover_tone: "sage", excerpt: "Pala, cengkih, dan kawan-kawan.", body: ["Pala dari Banda pernah memicu pelayaran antarbenua.", "Cengkih, lada, kayu manis, dan kunyit melengkapi jalur rempah."] },
  { slug: "etika-barter", title: "Etika barter: biar tukar-menukar tetap adil", tag: "Tukar Guling", cover_tone: "grenadine", excerpt: "Panduan menaksir nilai & menghindari sengketa.", body: ["Taksir nilai barang dengan jujur, dan foto kondisi apa adanya.", "Bila nilai timpang, seimbangkan dengan tambahan keping."] },
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

async function main() {
  console.log("Seeding merchants…");
  const merchantRows = merchants.map((m) => {
    const row = { ...m };
    delete row.products;
    return row;
  });
  const upserted = await rest("merchants?on_conflict=slug", {
    method: "POST",
    body: merchantRows,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  const idBySlug = Object.fromEntries(upserted.map((m) => [m.slug, m.id]));
  const ids = Object.values(idBySlug);

  console.log("Reset & seed merchant_products…");
  await rest(`merchant_products?merchant_id=in.(${ids.join(",")})`, { method: "DELETE" });
  const products = merchants.flatMap((m) =>
    m.products.map((p) => ({ ...p, merchant_id: idBySlug[m.slug] })),
  );
  await rest("merchant_products", { method: "POST", body: products });

  console.log("Seeding articles…");
  await rest("articles?on_conflict=slug", {
    method: "POST",
    body: articles.map((a) => ({ ...a, published_at: new Date().toISOString() })),
    prefer: "resolution=merge-duplicates",
  });

  console.log("Reset & seed price_listings…");
  await rest(`price_listings?product_key=eq.${encodeURIComponent(NERACA_KEY)}`, { method: "DELETE" });
  await rest("price_listings", {
    method: "POST",
    body: neraca.map((n) => ({
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

  console.log("Seeding barter_items…");
  const users = await fetch(`${URL_BASE}/auth/v1/admin/users`, { headers: H }).then((r) => r.json());
  const uid = users?.users?.[0]?.id;
  if (uid) {
    const titles = barter.map((b) => `"${b.title}"`).join(",");
    await rest(`barter_items?title=in.(${encodeURIComponent(titles)})`, { method: "DELETE" });
    await rest("barter_items", {
      method: "POST",
      body: barter.map((b) => ({ ...b, user_id: uid, status: "aktif" })),
    });
  } else {
    console.log("  (lewati barter — belum ada user)");
  }

  console.log("\n✓ Seed selesai.");
}

main().catch((e) => {
  console.error("\n✗ Seed gagal:", e.message);
  process.exit(1);
});
