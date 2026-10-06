// Uji aturan nominal Isi Pundi (murni): npx tsx scripts/uji/isi-nominal.ts
import { rincianIsi, saranIsi, tautanIsi, TOPUP_MAX } from "@/lib/pundi-paket";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const galat = (f: () => unknown) => { try { f(); return ""; } catch (e) { return (e as Error).message; } };

const p = rincianIsi("pedagang");
ok(p.price === 50_000 && p.keteng === 52_000 && p.packageId === "pedagang", "paket hemat tetap berbonus");
const n = rincianIsi("1500000");
ok(n.price === 1_500_000 && n.keteng === 1_500_000 && n.packageId === "nominal", "nominal bebas 1,5jt tanpa bonus");
ok(rincianIsi("10000000").price === 10_000_000, "nominal 10jt diterima");
ok(galat(() => rincianIsi("5000")).includes("minimal"), "di bawah Rp10.000 ditolak");
ok(galat(() => rincianIsi(String(TOPUP_MAX + 1000))).includes("maksimal"), "di atas Rp50jt ditolak");
ok(galat(() => rincianIsi("1500500")).includes("kelipatan"), "bukan kelipatan Rp1.000 ditolak");
ok(galat(() => rincianIsi("")).length > 0 && galat(() => rincianIsi("paket-palsu")).length > 0, "kosong / paket tak dikenal ditolak");
ok(saranIsi(1_432_150) === 1_433_000, "saran: kekurangan 1.432.150 → 1.433.000 (dibulatkan ke atas)");
ok(saranIsi(3_000) === 10_000, "saran minimal Rp10.000");
ok(saranIsi(99_000_000) === TOPUP_MAX, "saran tidak melebihi batas");
ok(tautanIsi(1_500_000) === "/pakhuis?isi_nominal=1500000#isi-pundi", "tautan Pakhuis dengan nominal terisi");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
