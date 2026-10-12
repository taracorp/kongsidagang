// UAT KiriminAja MitraAPI — jalankan semua skenario lewat UI instance UAT & simpan screenshot bukti.
//   node scripts/_uat2.mjs [fase]   fase: buat (default) | label | lacak | batal | webhook
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const B = "https://kongsi-uat.31-97-49-146.sslip.io";
const OUT = "uat-kiriminaja/bukti";
const CATATAN = "uat-kiriminaja/hasil.json";
const fase = process.argv[2] ?? "buat";
const hasil = existsSync(CATATAN) ? JSON.parse(readFileSync(CATATAN, "utf8")) : {};
const simpan = () => writeFileSync(CATATAN, JSON.stringify(hasil, null, 2));

const b = await chromium.launch({ args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await c.newPage();
p.on("pageerror", (e) => console.log("PAGEERR", e.message));
await p.goto(B + "/masuk");
await p.fill("#email", env.SEED_ADMIN_EMAIL);
await p.fill("#password", env.SEED_ADMIN_PASSWORD);
await Promise.all([p.waitForURL("**/pakhuis", { timeout: 30000 }), p.click('button[type="submit"]')]);

const buka = async () => {
  await p.goto(B + "/admin/kiriminaja", { waitUntil: "networkidle" });
  await p.addStyleTag({ content: '[class*="sticky"]{position:static!important}' });
};
const kartu = (t) => p.locator(`xpath=//h3[contains(., "${t}")]/..`);
const pesan = (t) => kartu(t).locator("p.mt-3").last();
const foto = async (loc, nama) => {
  await loc.scrollIntoViewIfNeeded();
  await loc.screenshot({ path: `${OUT}/${nama}.png` });
  console.log("📸", nama);
};

async function pilihWilayah(id, kata, cocok) {
  await p.fill(`#${id}`, kata);
  await p.locator(`#${id}`).locator("xpath=following-sibling::button").click();
  await p.waitForTimeout(4000);
  const opsi = p.locator(`li button:has-text("${cocok}")`);
  const ada = await opsi.count();
  return { ada, teks: await p.locator("li button").allInnerTexts(), opsi };
}

async function buatPaket(namaSkenario, asuransi, foto1, { bayar = "qris", layanan = "SPX Economy" } = {}) {
  // Pilih layanan yang diminta bila ada, selain itu layanan termurah yang tidak wajib asuransi.
  let baris = p.locator("tr", { hasText: layanan });
  if (!(await baris.count())) baris = p.locator("tr", { hasNotText: "wajib" }).filter({ has: p.locator('button:text-is("Pilih")') });
  await baris.first().locator('button:text-is("Pilih")').click();
  const k4 = kartu("4 · Buat paket");
  const cek = k4.locator('input[type="checkbox"]');
  if (!(await cek.isDisabled()) && (await cek.isChecked()) !== asuransi) await cek.click();
  await k4.locator(`button:has-text("${bayar === "credit" ? "KA Credit (saldo" : "Tagihan QRIS"}")`).click();
  await k4.locator('button:has-text("Buat paket")').click();
  await pesan("4 · Buat paket").waitFor({ timeout: 90000 });
  await p.waitForTimeout(500);
  const teks = await pesan("4 · Buat paket").innerText();
  console.log(namaSkenario, "→", teks);
  await foto(k4, foto1);
  return teks;
}

if (fase === "buat") {
  await buka();
  // 1. Autentikasi
  await kartu("1 · Autentikasi").locator('button:has-text("Uji API key")').click();
  await pesan("1 · Autentikasi").waitFor({ timeout: 60000 });
  hasil.auth = await pesan("1 · Autentikasi").innerText();
  console.log("AUTH:", hasil.auth);
  await foto(kartu("1 · Autentikasi"), "01-autentikasi");

  // 2. Cakupan wilayah
  const a = await pilihWilayah("wil-asal", "Ngaglik", "Sariharjo");
  hasil.coverage_asal = a.teks;
  await foto(kartu("2–3 · Cakupan"), "02-cakupan-cari-asal");
  if (a.ada) await a.opsi.first().click();
  const t = await pilihWilayah("wil-tujuan", "Kedungkandang", "Sawojajar");
  hasil.coverage_tujuan = t.teks;
  if (t.ada) await t.opsi.first().click();
  console.log("COVERAGE:", a.teks.length, "/", t.teks.length, "hasil");

  // 3. Ongkir — berat barang > berat volume
  await kartu("2–3 · Cakupan").locator('button:has-text("Berat barang > berat volume")').click();
  await kartu("2–3 · Cakupan").locator('button:has-text("Cek ongkir")').click();
  await p.locator("text=/layanan tersedia untuk rute ini/").first().waitFor({ timeout: 90000 });
  hasil.ongkir_berat = await kartu("2–3 · Cakupan").locator("table").innerText();
  await foto(kartu("2–3 · Cakupan"), "03-ongkir-berat");

  // 4–5. Create Non-COD berat > volume, tanpa & dengan asuransi (tagihan QRIS — tidak memotong saldo sandbox)
  hasil.buat4 = await buatPaket("Non-COD berat>volume", false, "04-buat-berat");
  hasil.buat5 = await buatPaket("Non-COD berat>volume + asuransi", true, "05-buat-berat-asuransi");

  // 6–7. Create Non-COD volume > berat, tanpa & dengan asuransi
  await kartu("2–3 · Cakupan").locator('button:has-text("Berat volume > berat barang")').click();
  await kartu("2–3 · Cakupan").locator('button:has-text("Cek ongkir")').click();
  await p.locator("text=/layanan tersedia untuk rute ini/").first().waitFor({ timeout: 90000 });
  hasil.ongkir_volume = await kartu("2–3 · Cakupan").locator("table").innerText();
  await foto(kartu("2–3 · Cakupan"), "03b-ongkir-volume");
  hasil.buat6 = await buatPaket("Non-COD volume>berat", false, "06-buat-volume");
  hasil.buat7 = await buatPaket("Non-COD volume>berat + asuransi", true, "07-buat-volume-asuransi");

  // 12. KA Credit — rute dekat Sleman → Kota Yogyakarta (hemat saldo sandbox), 2 order: label/lacak/webhook & batal.
  const y = await pilihWilayah("wil-tujuan", "Wirobrajan", "Kota Yogyakarta");
  hasil.coverage_yogya = y.teks;
  if (y.ada) await y.opsi.first().click();
  await kartu("2–3 · Cakupan").locator('button:has-text("Berat barang > berat volume")').click();
  await kartu("2–3 · Cakupan").locator('button:has-text("Cek ongkir")').click();
  await p.locator("text=/layanan tersedia untuk rute ini/").first().waitFor({ timeout: 90000 });
  hasil.ongkir_yogya = await kartu("2–3 · Cakupan").locator("table").innerText();
  await foto(kartu("2–3 · Cakupan"), "03c-ongkir-yogya");
  hasil.buat12a = await buatPaket("KA Credit #1", true, "12-buat-kacredit-1", { bayar: "credit", layanan: "AnterAja Regular" });
  hasil.buat12b = await buatPaket("KA Credit #2", true, "12-buat-kacredit-2", { bayar: "credit", layanan: "AnterAja Regular" });
  await kartu("1 · Autentikasi").locator('button:has-text("Uji API key")').click();
  await pesan("1 · Autentikasi").waitFor({ timeout: 60000 });
  await p.waitForTimeout(1500);
  hasil.saldo_setelah = await pesan("1 · Autentikasi").innerText();
  await foto(kartu("1 · Autentikasi"), "12-saldo-setelah");

  await buka();
  await foto(kartu("5–7 · Paket uji"), "08-daftar-paket");
  hasil.paket = await p.locator('a[href^="/label/uji/"]').evaluateAll((as) => as.map((x) => x.getAttribute("href")));
  hasil.daftar = await kartu("5–7 · Paket uji").innerText();
  simpan();
}

if (fase === "bersih") {
  // Batalkan semua paket uji yang ada (lacak dulu agar AWB tersimpan), sebelum uji ulang.
  await buka();
  const kotak = kartu("5–7 · Paket uji").locator("div.rounded-\\[4px\\]");
  const n = await kotak.count();
  for (let i = 0; i < n; i++) {
    const k = kotak.nth(i);
    await k.locator('button:has-text("Lacak")').click();
    await k.locator(".mt-3").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    await buka();
    const k2 = kartu("5–7 · Paket uji").locator("div.rounded-\\[4px\\]").nth(i);
    await k2.locator('button:has-text("Batalkan")').click();
    await k2.locator("p.mt-3").last().waitFor({ timeout: 60000 });
    await p.waitForTimeout(1000);
    console.log("BERSIH", i + 1, (await k2.innerText()).replace(/\s+/g, " ").slice(0, 260));
    await buka();
  }
}

if (fase === "label") {
  // Label untuk order KA Credit (sudah dibayar → AWB terbit), urut terlama dulu.
  await buka();
  const kotak = kartu("5–7 · Paket uji").locator("div.rounded-\\[4px\\]").filter({ hasText: "KA Credit" });
  const href = (await kotak.locator('a[href^="/label/uji/"]').evaluateAll((as) => as.map((x) => x.getAttribute("href")))).reverse();
  hasil.label_href = href;
  for (const [i, h] of href.entries()) {
    await p.goto(B + h, { waitUntil: "networkidle" });
    await p.locator(".label-a6").screenshot({ path: `${OUT}/13-label-${i + 1}.png` });
    console.log("📸 label", i + 1, h, (await p.locator(".label-a6").innerText()).replace(/\s+/g, " ").slice(0, 200));
    if (i === 0) await p.screenshot({ path: `${OUT}/13-label-halaman.png`, fullPage: true });
  }
  simpan();
}

if (fase === "lacak") {
  await buka();
  // Lacak semua paket (AWB & sorting code tersimpan dari respons tracking); bukti = paket tertua (#1).
  const kotak = kartu("5–7 · Paket uji").locator("div.rounded-\\[4px\\]").filter({ hasText: "KA Credit" });
  const n = await kotak.count();
  for (let i = n - 1; i >= 0; i--) {
    await kotak.nth(i).locator('button:has-text("Lacak")').click();
    await kotak.nth(i).locator(".mt-3").first().waitFor({ timeout: 60000 });
    await p.waitForTimeout(1500);
    console.log(`LACAK #${n - i}:`, (await kotak.nth(i).innerText()).replace(/\s+/g, " ").slice(0, 300));
  }
  const pertama = kotak.nth(n - 1);
  hasil.lacak = await pertama.innerText();
  await foto(pertama, "14-lacak");
  simpan();
}

if (fase === "batal") {
  await buka();
  // Batalkan paket terakhir dibuat (paling atas di daftar = terbaru).
  const kotak = kartu("5–7 · Paket uji").locator("div.rounded-\\[4px\\]").first();
  await kotak.locator('button:has-text("Batalkan")').click();
  await kotak.locator("p.mt-3").last().waitFor({ timeout: 60000 });
  await p.waitForTimeout(800);
  hasil.batal = await kotak.innerText();
  console.log("BATAL:", hasil.batal);
  await foto(kotak, "16-batal");
  simpan();
}

if (fase === "webhook") {
  await buka();
  const k = kartu("8 · Webhook");
  const d = k.locator("details").first();
  if (await d.count()) await d.locator("summary").click();
  await p.waitForTimeout(500);
  hasil.webhook = await k.innerText();
  console.log("WEBHOOK:", hasil.webhook.slice(0, 600));
  await foto(k, "15-webhook");
  await foto(kartu("5–7 · Paket uji"), "15b-paket-setelah-webhook");
  simpan();
}

await b.close();
