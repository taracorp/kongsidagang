// Uji parser BigGo dengan halaman asli (fixture) + pencocok: npx tsx --conditions=react-server scripts/uji/sumber.ts
import { readFileSync } from "node:fs";
import { uraiBigGo } from "@/lib/taksir/sumber";
import { tokenKueri, skorCocok } from "@/lib/taksir/ekstrak";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const html = readFileSync("scripts/uji/fixture-biggo.html", "utf8");
const items = uraiBigGo(html);
ok(items.length >= 20, `BigGo terurai: ${items.length} produk`);
ok(items.every((x) => x.harga > 0 && x.url.startsWith("http") && x.judul), "tiap produk punya judul, harga, url");
ok(new Set(items.map((x) => x.sumber)).size >= 2, `sumber beragam: ${[...new Set(items.map((x) => x.sumber))].join(", ")}`);
const q = "tv polytron 32 inch";
const tk = tokenKueri(q);
const cocok = items.filter((x) => skorCocok(tk, q, x.judul) > 0);
ok(cocok.length >= 5 && cocok.length < items.length, `pencocok menyaring: ${cocok.length}/${items.length}`);
ok(!cocok.some((x) => /backlight|bracket/i.test(x.judul)), "aksesoris tidak lolos");
console.log("contoh:", cocok.slice(0, 4).map((x) => `${x.sumber} Rp${x.harga.toLocaleString("id-ID")} ${x.judul.slice(0, 50)}`));
if (fail) { console.error(`${fail} gagal`); process.exit(1); }
