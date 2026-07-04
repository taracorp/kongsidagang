// Full-flow smoke test — Kongsi Dagang
// Jalankan dev/prod server dulu, lalu:
//   npm run flow
// Opsional auth: set KD_TEST_EMAIL & KD_TEST_PASSWORD (user Supabase yang sudah confirmed).
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3939";
const EMAIL = process.env.KD_TEST_EMAIL;
const PASSWORD = process.env.KD_TEST_PASSWORD;

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
await p.locator('button:has-text("Pemenang")').click();
await p.waitForTimeout(400);
check(
  "lelang fase Pemenang → tombol Bayar Sekarang",
  (await p.locator("text=Bayar Sekarang").count()) > 0,
);

await p.goto(`${BASE}/juru-tunjuk`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(500);
await p.locator('button:has-text("Makanan")').click();
await p.waitForTimeout(300);
await p.locator('button:has-text("Pedas")').click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Rp 25–75rb" }).click();
await p.waitForTimeout(400);
check(
  "juru tunjuk 3 langkah → hasil temuan",
  (await p.locator("text=Ini temuan Juru Tunjuk").count()) > 0,
);

if (EMAIL && PASSWORD) {
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
} else {
  console.log("SKIP  auth (set KD_TEST_EMAIL & KD_TEST_PASSWORD untuk uji login)");
}

await browser.close();
console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
process.exit(fail ? 1 : 0);
