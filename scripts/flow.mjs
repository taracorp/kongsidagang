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
// Akun pengelola lapak (Ketua) untuk uji validasi voucher oleh petugas.
const ADMIN_EMAIL = process.env.KD_ADMIN_EMAIL ?? local.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.KD_ADMIN_PASSWORD ?? local.SEED_ADMIN_PASSWORD;
const LAPAK = "beauty-center-drw-skincare";

async function masuk(page, email, password) {
  await page.goto(`${BASE}/masuk`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL("**/pakhuis", { timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

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

async function kodeVoucher(page) {
  await page.goto(`${BASE}/pakhuis`, { waitUntil: "networkidle" });
  // Hanya Surat Jalan aktif: teks antara judul "Surat Jalan (" dan bagian berikutnya.
  const semua = await page.locator("main").innerText().catch(() => "");
  const teks = semua.split(/Surat Jalan \(/)[1]?.split(/Surat Jalan terpakai|Level/)[0] ?? "";
  return [...teks.matchAll(/\b[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}\b/g)].map((m) => m[0]);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
const p = await ctx.newPage();

// Guest: tambah e-voucher ke keranjang tanpa akun (pilih cabang di lembar bawah)
await p.goto(`${BASE}/lapak/${LAPAK}`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
check("lapak asli tampil (Beauty Center)", (await p.locator("text=Beauty Center DRW Skincare").count()) > 0);
const add = p.locator('button:has-text("+ Keranjang")');
for (const i of [0, 1]) {
  await add.nth(i).click();
  const sheet = p.locator('[aria-label="Pilih cabang"]');
  await sheet.waitFor({ timeout: 5000 }).catch(() => {});
  if (i === 0) check("pilih cabang muncul sebelum masuk keranjang", (await sheet.count()) > 0);
  await sheet.locator("button").nth(1).click(); // tombol 0 = Tutup
  await p.waitForTimeout(300);
}
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
check("keranjang menyebut cabang", (await p.locator("text=/DRW Beauty Center|Rumtik DRW/").count()) > 0);

await p.goto(`${BASE}/bayar`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
check(
  "bayar (guest) → GATE minta daftar",
  (await p.locator("text=Daftar dulu untuk menebus").count()) > 0,
);

await p.goto(`${BASE}/lelang`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
const adaLelang = (await p.locator("text=Belum ada lelang berjalan").count()) === 0;
if (adaLelang) {
  check("lelang (guest) → ajakan Masuk untuk Ikut", (await p.locator("text=Masuk untuk Ikut Lelang").count()) > 0);
} else {
  check("lelang kosong → status kosong yang jujur", true);
}

// Harga rahasia tidak boleh ada di HTML publik. deal_price (seed 400000) tidak pernah boleh tampil;
// set_price (470000) SAH tampil sebagai revealed_price setelah fase pengungkapan, jadi tidak dicek angkanya.
const html = await (await fetch(`${BASE}/lelang`)).text();
check(
  "harga rahasia tidak bocor di /lelang",
  !/set_price|deal_price|400\.?000/.test(html),
);

await p.goto(`${BASE}/lapak`, { waitUntil: "domcontentloaded" });
check("/lapak tampil dari DB", (await p.locator("text=Beauty Center DRW Skincare").count()) > 0);
check("DRW Studio 'segera hadir'", (await p.locator("text=DRW Studio").count()) > 0);
const lama = await fetch(`${BASE}/loji`, { redirect: "manual" });
check("/loji dialihkan ke /lapak", [301, 308].includes(lama.status) && (lama.headers.get("location") ?? "").endsWith("/lapak"));
const htmlLapak = await (await fetch(`${BASE}/lapak`)).text();
check("tidak ada loji palsu lagi", !/Loji Rumah Tangga|Warung Rempah/.test(htmlLapak));

await p.goto(`${BASE}/kabar`, { waitUntil: "domcontentloaded" });
const artikel = p.locator('a[href^="/kabar/"]').first();
check("kabar tampil artikel", (await artikel.count()) > 0);
if (await artikel.count()) {
  await artikel.click();
  await p.waitForURL("**/kabar/**", { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(600);
  check("artikel berisi ≥3 paragraf", (await p.locator("article p, main p").count()) >= 3);
}

await p.goto(`${BASE}/juru-tunjuk`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
await p.locator('button:has-text("Jerawat")').click();
await p.waitForTimeout(300);
await p.locator('button:has-text("Mana saja")').click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Berapa saja" }).click();
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
  await masuk(p2, EMAIL, PASSWORD);
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

  // Isi Pundi dulu agar uji bayar tidak bergantung pada sisa saldo (butuh ENABLE_TOPUP_DEMO=true).
  await p2.goto(`${BASE}/pakhuis`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  await p2.waitForTimeout(700);
  await p2.click('button:has-text("Juragan")');
  await p2.click('button:has-text("Isi 270.000 Keteng")');
  // Mode DOKU: tombol membuka halaman bayar (dev server butuh waktu kompilasi); mode demo: tetap di Pakhuis.
  await p2.waitForURL("**/pakhuis/isi/tiruan**", { timeout: 20000 }).catch(() => {});
  await p2.waitForTimeout(1000);
  // Mode DOKU tiruan (DOKU_MOCK=true): selesaikan di halaman bayar simulasi.
  if (p2.url().includes("/pakhuis/isi/tiruan")) {
    await p2.click('button:has-text("Bayar (simulasi sukses)")');
    await p2.waitForURL("**/pakhuis?isi=**", { timeout: 20000 });
    check("isi pundi DOKU (tiruan) → Keteng masuk", (await p2.locator("text=Pembayaran diterima").count()) > 0);
  }

  // Bayar dengan Keteng (keranjang masih berisi 2 e-voucher dari langkah guest)
  const kodeSebelum = await kodeVoucher(p2);
  await p2.goto(`${BASE}/bayar`, { waitUntil: "networkidle" });
  const payBtn = p2.locator('button:has-text("Keteng")').first();
  await payBtn.waitFor({ timeout: 15000 }).catch(() => {});
  if (await payBtn.count()) {
    await payBtn.click();
    const sukses = p2.locator("text=/[Bb]erhasil|[Tt]erbayar|[Ll]unas/").first();
    await sukses.waitFor({ timeout: 15000 }).catch(() => {});
    check("bayar pakai Keteng berhasil", (await sukses.count()) > 0);
  } else {
    check("tombol bayar Keteng tersedia", false);
  }

  // Surat Jalan berkode di Pakhuis + lonceng
  const kodeSesudah = await kodeVoucher(p2);
  const baru = kodeSesudah.filter((k) => !kodeSebelum.includes(k));
  check(`2 Surat Jalan baru berkode (${baru.join(", ")})`, baru.length === 2);
  const lonceng = p2.locator('a[href="/kabar-saya"] span').first();
  await p2.waitForTimeout(500);
  const belum = Number((await lonceng.count()) ? await lonceng.textContent() : 0);
  check(`lonceng menghitung kabar belum dibaca (${belum})`, belum > 0);
  await p2.goto(`${BASE}/kabar-saya`, { waitUntil: "networkidle" });
  check("kabar-saya berisi Surat Jalan terbit", (await p2.locator("text=Surat Jalan terbit").count()) > 0);
  await p2.goto(`${BASE}/pakhuis`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(800);
  check("lonceng nol setelah dibaca", (await p2.locator('a[href="/kabar-saya"] span').filter({ hasText: /^\d+\+?$/ }).count()) === 0);

  // Petugas lapak memvalidasi satu voucher
  if (baru.length && ADMIN_EMAIL && ADMIN_PASSWORD) {
    const adm = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const pa = await adm.newPage();
    await masuk(pa, ADMIN_EMAIL, ADMIN_PASSWORD);
    await pa.goto(`${BASE}/pakhuis/lapak`, { waitUntil: "networkidle" });
    // Cari cabang voucher dari Pakhuis pembeli, lalu pilih cabang itu di form validasi.
    const opsi = await pa.locator('[aria-label="Cabang petugas"] option').allTextContents();
    let ok = false;
    for (const [i] of opsi.entries()) {
      await pa.locator('[aria-label="Cabang petugas"]').selectOption({ index: i });
      await pa.fill('[aria-label="Kode voucher"]', baru[0]);
      await pa.click('form:has([aria-label="Kode voucher"]) button[type="submit"]');
      await pa.waitForTimeout(1200);
      if (await pa.locator("text=/✓ .* atas nama/").count()) { ok = true; break; }
      if (!(await pa.locator("text=/hanya berlaku di cabang/").count())) break;
    }
    check("petugas lapak memvalidasi voucher", ok);
    await pa.fill('[aria-label="Kode voucher"]', baru[0]);
    await pa.click('form:has([aria-label="Kode voucher"]) button[type="submit"]');
    await pa.waitForTimeout(1200);
    check("voucher yang sama ditolak kedua kali", (await pa.locator("text=/sudah ditebus/").count()) > 0);
    await adm.close();
  } else {
    console.log("SKIP  validasi petugas (SEED_ADMIN_* tidak ada)");
  }

  // Tukar Guling: unggah barang 4 langkah (taksiran sistem) + foto
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  const judul = `Uji Flow ${Date.now()}`;
  await p2.goto(`${BASE}/tukar/tawarkan`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1000);
  await p2.click('button:has-text("Lainnya")');
  await p2.click('button:has-text("Lanjut")');
  await p2.fill("#title", judul);
  await p2.click('button:has-text("Baru")');
  await p2.fill("#price", "200000");
  await p2.fill("#year", String(new Date().getFullYear() - 1));
  await p2.click('button:has-text("Cari harga pasar")');
  await p2.locator("text=Pembanding (").waitFor({ timeout: 60000 }).catch(() => {});
  check("tukar: Juru Taksir riset harga pasar", (await p2.locator("text=Pembanding (").count()) > 0);
  await p2.click('button:has-text("Lanjut")');
  for (const t of await p2.locator('button:text-is("Tidak")').all()) await t.click();
  check("tukar: taksiran sistem tampil", (await p2.locator("text=Taksiran Kongsi").count()) > 0);
  await p2.click('button:has-text("Lanjut")');
  await p2.setInputFiles("#photo", { name: "uji.png", mimeType: "image/png", buffer: png });
  await Promise.all([
    p2.waitForURL("**/tukar", { timeout: 20000 }).catch(() => {}),
    p2.click('button:has-text("Unggah Barang")'),
  ]);
  await p2.waitForTimeout(1000);
  check("tukar: barang baru tampil", (await p2.locator(`text=${judul}`).count()) > 0);
  const img = p2.locator('img[src^="/uploads/barter/"]').first();
  const src = (await img.count()) ? await img.getAttribute("src") : null;
  check("tukar: foto tersimpan & tersaji", Boolean(src) && (await fetch(`${BASE}${src}`)).status === 200);

  // Vendu terbuka untuk yang login
  await p2.goto(`${BASE}/lelang?jenis=vendu`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(800);
  check("vendu (login) tidak terkunci", (await p2.locator("text=Vendu khusus anggota").count()) === 0);
} else {
  console.log("SKIP  auth (set KD_TEST_EMAIL & KD_TEST_PASSWORD untuk uji login)");
}

// Vendu terkunci untuk tamu
const guest = await browser.newContext();
const pg = await guest.newPage();
await pg.goto(`${BASE}/lelang?jenis=vendu`, { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(800);
check("vendu (tamu) terkunci", (await pg.locator("text=Vendu khusus anggota").count()) > 0);

await browser.close();
console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
