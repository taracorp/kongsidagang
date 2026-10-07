// Uji rumus biaya pembayaran & platform fee (tanpa DB):
//   npx tsx scripts/uji/biaya.ts
import { METODE, PLATFORM_FEE, platformFee, potonganDoku, rincianBayar, cariMetode } from "@/lib/payment/biaya";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };

// 1. Untuk semua metode & banyak nominal: setelah dipotong DOKU (+PPN), Kongsi menerima ≥ neto, lebihnya < Rp200.
let semua = true, maksLebih = 0;
for (const m of METODE) {
  for (let neto = 10_000; neto <= 5_000_000; neto += 7_919) {
    const { total, biaya } = rincianBayar(neto, m.kode);
    const terima = total - potonganDoku(total, m);
    const lebih = terima - neto;
    if (terima < neto || lebih >= 200 || total !== neto + biaya || total % 100 !== 0) semua = false;
    maksLebih = Math.max(maksLebih, lebih);
  }
}
ok(semua, `semua metode: terima bersih ≥ neto, kelebihan maks Rp${maksLebih} (< Rp200), total kelipatan Rp100`);

// 2. Contoh nyata (voucher Rp125.000 + platform fee Rp4.000 = neto Rp129.000)
const contoh = (kode: string) => rincianBayar(129_000, kode);
const q = contoh("QRIS"), va = contoh("VIRTUAL_ACCOUNT_BCA"), sp = contoh("EMONEY_SHOPEEPAY"), cc = contoh("CREDIT_CARD");
console.log(`  QRIS ${q.total} (biaya ${q.biaya}) · VA BCA ${va.total} (${va.biaya}) · ShopeePay ${sp.total} (${sp.biaya}) · Kartu ${cc.total} (${cc.biaya})`);
ok(q.biaya >= Math.ceil(129_000 * 0.007 * 1.11) && q.biaya < 1_300, "QRIS: biaya ≈ 0,7% + PPN");
ok(va.biaya >= 4_995 && va.biaya <= 5_100, "VA BCA: biaya ≈ Rp4.500 + PPN = Rp4.995");
ok(contoh("VIRTUAL_ACCOUNT_BRI").biaya >= 4_440, "VA bank lain: biaya ≥ Rp4.440");
ok(sp.total - potonganDoku(sp.total, cariMetode("EMONEY_SHOPEEPAY")) >= 129_000, "ShopeePay 4%: tetap terima bersih");

// 3. Platform fee
ok(PLATFORM_FEE === 4_000, "platform fee Rp4.000");
ok(platformFee(false).total === 4_000 && platformFee(false).ppn === 0, "belum PKP: tanpa PPN");
ok(platformFee(true).ppn === 440 && platformFee(true).total === 4_440, "PKP: + PPN 11% (Rp440)");

// 4. Metode tak dikenal ditolak
let ditolak = false;
try { rincianBayar(50_000, "ONLINE_TO_OFFLINE_ALFA"); } catch { ditolak = true; }
ok(ditolak, "metode yang dimatikan (minimarket) ditolak");

if (fail) { console.error(`${fail} gagal`); process.exit(1); }
