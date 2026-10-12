// UAT KiriminAja — langkah 1–3 (auth, coverage, pricing) di instance UAT.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^["']|["']$/g,"")]));
const B = "https://kongsi-uat.31-97-49-146.sslip.io", OUT = "uat-kiriminaja/bukti";
const b = await chromium.launch({ args:["--no-sandbox"] });
const c = await b.newContext({ viewport:{ width:1366, height:900 }, deviceScaleFactor: 1 });
const p = await c.newPage();
p.on("pageerror", e => console.log("PAGEERR", e.message));
await p.goto(B+"/masuk"); await p.fill("#email", env.SEED_ADMIN_EMAIL); await p.fill("#password", env.SEED_ADMIN_PASSWORD);
await Promise.all([p.waitForURL("**/pakhuis", { timeout: 30000 }), p.click('button[type="submit"]')]);
await p.goto(B+"/admin/kiriminaja", { waitUntil: "networkidle" });
await p.addStyleTag({ content: '[class*="sticky"]{position:static!important}' });
const kartu = (t) => p.locator(`xpath=//h3[contains(., "${t}")]/..`);
// 1. Auth
await p.click('button:has-text("Uji API key")');
await kartu("1 · Autentikasi").locator("p.mt-3").waitFor({ timeout: 30000 });
console.log("AUTH:", await kartu("1 · Autentikasi").innerText());
await p.screenshot({ path: `${OUT}/01-auth-halaman.png` });
await kartu("1 · Autentikasi").screenshot({ path: `${OUT}/01-auth.png` });
// 2. Coverage
await p.fill("#wil-asal", "Sariharjo");
await p.locator("#wil-asal").locator("xpath=following-sibling::button").click();
await p.waitForTimeout(4000);
await kartu("2–3 · Cakupan").screenshot({ path: `${OUT}/02-coverage-cari.png` });
const pilihan = p.locator('li button:has-text("Ngaglik")');
console.log("hasil cari asal:", await p.locator("li button").allInnerTexts());
if (await pilihan.count()) await pilihan.first().click();
await p.fill("#wil-tujuan", "Sawojajar");
await p.locator("#wil-tujuan").locator("xpath=following-sibling::button").click();
await p.waitForTimeout(4000);
console.log("hasil cari tujuan:", await p.locator("li button").allInnerTexts());
const t2 = p.locator('li button:has-text("Kedungkandang")');
if (await t2.count()) await t2.first().click();
// 3. Pricing
await p.click('button:has-text("Cek ongkir")');
await p.locator("text=/layanan tersedia untuk rute ini/").or(kartu("2–3 · Cakupan").locator("p.mt-3")).first().waitFor({ timeout: 60000 });
await kartu("2–3 · Cakupan").screenshot({ path: `${OUT}/03-pricing.png` });
console.log("TARIF:", (await p.locator("table").innerText()).slice(0, 1500));
await b.close();
