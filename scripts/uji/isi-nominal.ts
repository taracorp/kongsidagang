// Uji aturan nominal Isi Pundi (murni): npx tsx scripts/uji/isi-nominal.ts
import { nominalIsi, saranIsi, tautanIsi, TOPUP_MAX } from "@/lib/pundi-paket";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
const galat = (f: () => unknown) => { try { f(); return ""; } catch (e) { return (e as Error).message; } };

ok(galat(() => nominalIsi("pedagang")).length > 0, "paket bonus lama sudah tidak ada");
ok(nominalIsi("1500000") === 1_500_000 && nominalIsi("1.500.000") === 1_500_000, "nominal 1,5jt → 1,5jt Keteng (tanpa bonus)");
ok(nominalIsi("10000000") === 10_000_000, "nominal 10jt diterima");
ok(galat(() => nominalIsi("5000")).includes("minimal"), "di bawah Rp10.000 ditolak");
ok(galat(() => nominalIsi(String(TOPUP_MAX + 1000))).includes("maksimal"), "di atas Rp50jt ditolak");
ok(galat(() => nominalIsi("1500500")).includes("kelipatan"), "bukan kelipatan Rp1.000 ditolak");
ok(galat(() => nominalIsi("")).length > 0 && galat(() => nominalIsi("paket-palsu")).length > 0, "kosong / teks ditolak");
ok(saranIsi(1_432_150) === 1_433_000, "saran: kekurangan 1.432.150 → 1.433.000 (dibulatkan ke atas)");
ok(saranIsi(3_000) === 10_000, "saran minimal Rp10.000");
ok(saranIsi(99_000_000) === TOPUP_MAX, "saran tidak melebihi batas");
ok(tautanIsi(1_500_000) === "/pakhuis?isi_nominal=1500000#isi-pundi", "tautan Pakhuis dengan nominal terisi");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
