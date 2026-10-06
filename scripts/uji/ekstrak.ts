// Uji pembaca harga & pencocok produk Juru Taksir: npx tsx scripts/uji/ekstrak.ts
import { bacaHarga, tokenKueri, skorCocok, deteksiKondisi, ringkas, olahPembanding, type Pembanding } from "@/lib/taksir/ekstrak";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const sama = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b);

// Harga (contoh dari cuplikan nyata)
ok(sama(bacaHarga("Harga mulai Rp.2.999.000, s/d Rp.2.199.000."), [2999000, 2199000]), "format Rp.2.999.000,");
ok(sama(bacaHarga("Rp2.459.550"), [2459550]), "Rp2.459.550");
ok(sama(bacaHarga("kisaran Rp2 juta hingga Rp3 juta"), [2000000, 3000000]), "Rp2 juta");
ok(sama(bacaHarga("cuma 1,25jt nego"), [1250000]), "1,25jt tanpa Rp");
ok(sama(bacaHarga("harga 2.5 jt"), [2500000]), "2.5 jt = 2,5 juta (bukan 25 juta)");
ok(sama(bacaHarga("850rb aja"), [850000]), "850rb");
ok(sama(bacaHarga("Rp 1.250.000,00"), [1250000]), "sen ,00 dibuang");
ok(sama(bacaHarga("cicilan Rp 250.000 / bulan, harga Rp 3.000.000"), [3000000]), "cicilan dibuang");
ok(sama(bacaHarga("hemat Rp 500.000 jadi Rp 2.500.000"), [2500000]), "nominal diskon dibuang");
ok(sama(bacaHarga("TV 32 inch tahun 2021 model 32T8511"), []), "angka polos bukan harga");

// Pencocok
const q = "TV LED 32 inch Polytron PLD 32T1850";
const tk = tokenKueri(q);
ok(tk.kuat.includes("polytron") && tk.kuat.includes("32t1850") && tk.kuat.includes("32"), `token kuat ${JSON.stringify(tk.kuat)}`);
ok(skorCocok(tk, q, 'POLYTRON LED TV 32 Inch PLD 32T1850 Tower Speaker 32" PLD32T1850') > 0, "judul model sama → cocok");
ok(skorCocok(tk, q, "LED TV 32 INCH POLYTRON FULL HD GOOGLE TV PLD-32RG5059") === 0, "model lain → tidak cocok");
ok(skorCocok(tk, q, "Backlight TV POLYTRON 32 Inch PLD-32T1850") === 0, "aksesoris (backlight) → dibuang");
ok(skorCocok(tk, q, "POLYTRON LED TV 43 Inch PLD 43T1850") === 0, "ukuran lain (43) → tidak cocok");
const q2 = "Sepeda Polygon Cascade 4";
ok(skorCocok(tokenKueri(q2), q2, "Sepeda MTB Polygon Cascade 4 27.5 bekas mulus") > 0, "sepeda Polygon Cascade 4 cocok");
ok(skorCocok(tokenKueri(q2), q2, "Sepeda United Detroit 27.5") === 0, "merek lain → tidak cocok");

// Kondisi
ok(deteksiKondisi("TV Polytron 32 bekas mulus", "https://shopee.co.id/x", "Shopee") === "bekas", "kata 'bekas'");
ok(deteksiKondisi("TV Polytron 32", "https://www.olx.co.id/item/x", "OLX") === "bekas", "OLX = bekas");
ok(deteksiKondisi("TV Polytron 32 garansi resmi", "https://www.blibli.com/p/x", "Blibli") === "baru", "toko resmi = baru");

// Statistik
const r = ringkas([2_200_000, 2_300_000, 2_250_000, 2_400_000, 90_000]);
ok(!!r && r.n === 4 && r.min === 2_200_000, "outlier 90rb dibuang");
const pb = (harga: number, kondisi: "baru" | "bekas", url: string): Pembanding => ({ sumber: "x", judul: "TV " + url, harga, kondisi, url, asal: "biggo" });
const o = olahPembanding([pb(2_675_000, "baru", "a"), pb(2_675_000, "baru", "a"), pb(2_500_000, "baru", "b"), pb(2_600_000, "baru", "c"), pb(1_500_000, "bekas", "d"), pb(1_400_000, "bekas", "e"), pb(110_000, "baru", "f")]);
ok(o.statistik.baru?.n === 3 && o.statistik.bekas?.n === 2, "duplikat & sisa aksesoris dibuang, baru/bekas dipisah");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
