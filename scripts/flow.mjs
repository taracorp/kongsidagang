// Full-flow smoke test — Kongsi Dagang (Prisma + Better Auth)
// Jalankan dev/prod server dulu, lalu:
//   npm run flow
// Opsional auth: KD_TEST_EMAIL & KD_TEST_PASSWORD (default: SEED_TESTER_* dari .env.local).
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

function envLocal() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}
const local = envLocal();

const BASE = process.env.SHOT_BASE ?? "http://localhost:3939";
const EMAIL = process.env.KD_TEST_EMAIL ?? local.SEED_TESTER_EMAIL;
// KD_SKIP_AUTH=1 untuk uji produksi tanpa akun penguji.
const SKIP_AUTH = process.env.KD_SKIP_AUTH === "1";
const PASSWORD = process.env.KD_TEST_PASSWORD ?? local.SEED_TESTER_PASSWORD;

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) pass++;
  else fail++;
  console.log((cond ? "PASS" : "FAIL").padEnd(5), name);
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
const p = await ctx.newPage();

// Guest: tambah ke keranjang tanpa akun
await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(700);
const add = p.locator('button:has-text("+ Keranjang")');
await add.first().click();
await add.nth(1).click();
await p.waitForTimeout(400);
const badge = await p
  .locator('a[href="/keranjang"] span')
  .first()
  .textContent()
  .catch(() => null);
check("guest tambah 2 barang → badge=2", badge === "2");

await p.goto(`${BASE}/keranjang`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
check("keranjang tampil Ringkasan", (await p.locator("text=Ringkasan").count()) > 0);

await p.goto(`${BASE}/bayar`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
check(
  "bayar (guest) → GATE minta daftar",
  (await p.locator("text=Daftar dulu untuk menebus").count()) > 0,
);

await p.goto(`${BASE}/lelang`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
check(
  "lelang tampil auction dari DB (clue kategori)",
  (await p.locator("text=Hotel Bintang 4").count()) > 0,
);
check(
  "lelang (guest) → ajakan Masuk untuk Ikut",
  (await p.locator("text=Masuk untuk Ikut Lelang").count()) > 0,
);

// Harga rahasia tidak boleh ada di HTML publik (set_price seed: 470000 / deal 400000)
const html = await (await fetch(`${BASE}/lelang`)).text();
check(
  "harga rahasia tidak bocor di /lelang",
  !/set_price|deal_price|470\.?000/.test(html),
);

await p.goto(`${BASE}/loji`, { waitUntil: "domcontentloaded" });
check("loji tampil dari DB", (await p.locator("text=Loji Rumah Tangga").count()) > 0);

await p.goto(`${BASE}/juru-tunjuk`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
await p.locator('button:has-text("Makanan")').click();
await p.waitForTimeout(300);
await p.locator('button:has-text("Pedas")').click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Rp 25–75rb" }).click();
await p.waitForTimeout(1200);
check(
  "juru tunjuk 3 langkah → hasil temuan",
  (await p.locator("text=Ini temuan Juru Tunjuk").count()) > 0,
);

// Endpoint cron menolak tanpa rahasia
const cronRes = await fetch(`${BASE}/api/cron/advance-auctions`, { method: "POST" });
check("cron tanpa CRON_SECRET → 401", cronRes.status === 401);

if (!SKIP_AUTH && EMAIL && PASSWORD) {
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/masuk`, { waitUntil: "domcontentloaded" });
  await p2.fill("#email", EMAIL);
  await p2.fill("#password", PASSWORD);
  await Promise.all([
    p2.waitForURL("**/pakhuis", { timeout: 20000 }).catch(() => {}),
    p2.click('button[type="submit"]'),
  ]);
  await p2.waitForTimeout(1000);
  check("login → /pakhuis", p2.url().includes("/pakhuis"));
  check("pakhuis tampil Surat Jalan", (await p2.locator("text=Surat Jalan").count()) > 0);
  check("TopBar → Pakhuis-ku saat login", (await p2.locator("text=Pakhuis-ku").count()) > 0);

  // Tebak lelang
  await p2.goto(`${BASE}/lelang`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  const guessInput = p2.locator('input[name="guess"]').first();
  if (await guessInput.count()) {
    await guessInput.fill("455000");
    await p2.locator('form:has(input[name="guess"]) button[type="submit"]').first().click();
    await p2.waitForTimeout(1500);
    check("tebak lelang tersimpan (tanpa error)", (await p2.locator("text=/Silakan masuk|tidak menerima/").count()) === 0);
  } else {
    console.log("SKIP  tebak (lelang bukan fase tebak saat ini)");
  }

  // Bayar dengan Keping (keranjang masih berisi 2 barang dari langkah guest)
  await p2.goto(`${BASE}/bayar`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1000);
  const payBtn = p2.locator('button:has-text("Keping")').first();
  if (await payBtn.count()) {
    await payBtn.click();
    await p2.waitForTimeout(2000);
    check("bayar pakai Keping berhasil", (await p2.locator("text=/[Bb]erhasil|[Tt]erbayar|[Ll]unas/").count()) > 0);
  } else {
    check("tombol bayar Keping tersedia", false);
  }

  // Tukar Guling: unggah barang + foto (pengganti Supabase Storage)
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  const judul = `Uji Flow ${Date.now()}`;
  await p2.goto(`${BASE}/tukar/tawarkan`, { waitUntil: "domcontentloaded" });
  await p2.fill('input[name="title"]', judul);
  await p2.fill('input[name="est_value"]', "150000");
  await p2.setInputFiles('input[name="photo"]', { name: "uji.png", mimeType: "image/png", buffer: png });
  await Promise.all([
    p2.waitForURL("**/tukar", { timeout: 20000 }).catch(() => {}),
    p2.click('button[type="submit"]'),
  ]);
  await p2.waitForTimeout(1000);
  check("tukar: barang baru tampil", (await p2.locator(`text=${judul}`).count()) > 0);
  const img = p2.locator('img[src^="/uploads/barter/"]').first();
  const src = (await img.count()) ? await img.getAttribute("src") : null;
  check("tukar: foto tersimpan & tersaji", Boolean(src) && (await fetch(`${BASE}${src}`)).status === 200);

  // Vendu terbuka untuk yang login
  await p2.goto(`${BASE}/lelang?jenis=vendu`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(800);
  check("vendu (login) tampil lelang", (await p2.locator("text=Fine Dining").count()) > 0);
} else {
  console.log("SKIP  auth (set KD_TEST_EMAIL & KD_TEST_PASSWORD untuk uji login)");
}

// Vendu terkunci untuk tamu
const guest = await browser.newContext();
const pg = await guest.newPage();
await pg.goto(`${BASE}/lelang?jenis=vendu`, { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(800);
check("vendu (tamu) terkunci", (await pg.locator("text=Fine Dining").count()) === 0);

await browser.close();
console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
