// Uji alur Tukar Guling v3 (COD; selisih = uang rekber, Keteng = jaminan) di kongsi_dev:
//   npx tsx --conditions=react-server scripts/uji/tukar.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.ENABLE_TOPUP_DEMO = "true";
process.env.DOKU_MOCK = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const T = await import("@/lib/domain/tukar");
  const R = await import("@/lib/domain/tukar-aturan");
  const L = await import("@/lib/domain/bayar-langsung");
  const Bayar = await import("@/lib/domain/pembayaran");
  const Rek = await import("@/lib/domain/rekening");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message || "galat"; } };

  const ids = ["uji-tukar-a", "uji-tukar-b", "uji-tukar-c", "uji-tukar-admin"];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const [A, B, C, ADMIN] = ids;
  const akun = (id: string) => ({ id, name: id, email: `${id}@uji.local` });
  const bal = async (u: string) => (await prisma.wallet.findUnique({ where: { user_id: u } }))?.balance ?? 0;
  const item = (user_id: string, title: string, est_value: number) =>
    prisma.barterItem.create({ data: { user_id, title, est_value, status: "aktif" } });
  const deal = (id: string) => prisma.barterDeal.findUniqueOrThrow({ where: { id } });
  const ditahan = async (dealId: string, u: string) =>
    (await prisma.walletHold.aggregate({ where: { deal_id: dealId, user_id: u, status: "ditahan" }, _sum: { amount: true } }))._sum.amount ?? 0;
  const transfer = (dealId: string) => prisma.transferKeluar.findMany({ where: { deal_id: dealId }, orderBy: { created_at: "asc" } });
  const meet = { meetType: "minimarket", meetPlace: "Indomaret Kaliurang km 5" };
  const SITE = "https://kongsidagang.store";
  /** Pembayar menyetor lewat DOKU tiruan (selisih uang + Keteng jaminan yang kurang), lalu DOKU melaporkan lunas. */
  async function setorDoku(u: string, dealId: string, metode = "VIRTUAL_ACCOUNT_BRI") {
    const r = await L.mulaiBayarLangsung(akun(u), "tukar_setor", { dealId }, "kurang", metode, SITE);
    const o = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: r.invoice } });
    await Bayar.prosesLunas(r.invoice, o.price, "VA");
    return prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: r.invoice } });
  }

  try {
    // ---------- Aturan murni ----------
    const wib = (s: string) => new Date(`${s}+07:00`);
    ok(R.tenggatBayar(wib("2026-10-13T21:00:00")).getTime() === wib("2026-10-14T09:00:00").getTime(), "diterima 21.00 → tenggat 09.00 besok");
    ok(R.tenggatBayar(wib("2026-10-13T13:00:00")).getTime() === wib("2026-10-14T10:00:00").getTime(), "jatuh 01.00 → digeser ke 10.00");
    ok(R.tenggatBayar(wib("2026-10-13T10:30:00")).getTime() === wib("2026-10-14T10:00:00").getTime(), "jatuh 22.30 → 10.00 besok");
    ok(R.tenggatBayar(wib("2026-10-13T08:00:00")).getTime() === wib("2026-10-13T20:00:00").getTime(), "jatuh 20.00 → tetap");
    ok(R.tambahHariKerja(wib("2026-10-16T15:00:00"), 2).getTime() === wib("2026-10-20T15:00:00").getTime(), "Jumat + 2 hari kerja = Selasa");
    ok((await galat(async () => R.validasiTambah(132_000, 2_907_000, 2_775_000))).includes("50%"), "kasus Lumia ⇄ Legion: selisih > 50% ditolak");
    ok(R.validasiTambah(100_000, 150_000, 50_000) === "a" && R.validasiTambah(150_000, 100_000, 0) === null, "selisih dalam batas sah");
    ok(R.estimasiCadangan(50_000, 10_000) > R.BIAYA_TRANSFER && R.estimasiCadangan(0, 10_000) === 0, "cadangan = biaya transfer + biaya DOKU");
    ok(R.depositKirim(200_000, 30_000) === 30_000 && R.depositKirim(200_000, 9_000) === 20_000, "deposit ≥ ongkir paket keluar");
    ok(R.bolehkah("menunggu_bayar", "a", "setor") && !R.bolehkah("proposed", "a", "setor"), "setor hanya saat menunggu bayar");

    for (const u of [A, B, C]) await P.topupDemo(u, "200000");
    const kecil = await item(A, "Kamera Saku", 100_000);
    const besar = await item(B, "Tablet Bekas", 150_000);
    const hpC = await item(C, "HP Lawas", 120_000);

    // ---------- Ajukan gratis ----------
    ok((await galat(() => T.ajukan(A, kecil.id, besar.id, 50_000))).includes("rekening"), "selisih uang wajib rekening pengaju");
    for (const u of [A, B, C]) await Rek.simpanRekening(u, { bank: "BCA", nomor: "1234567890", atas_nama: `Pemilik ${u}` });
    const a0 = await bal(A);
    const d1 = await T.ajukan(A, kecil.id, besar.id, 50_000);
    ok((await bal(A)) === a0 && (await prisma.walletHold.count({ where: { deal_id: d1 } })) === 0, "mengajukan gratis — tidak ada yang ditahan");
    const dC = await T.ajukan(C, hpC.id, besar.id, 30_000);
    ok((await deal(d1)).selisih_uang === 50_000 && (await deal(d1)).biaya_transfer === R.BIAYA_TRANSFER, "selisih uang + biaya transfer tercatat");

    // ---------- Terima → menunggu bayar ----------
    const b0 = await bal(B);
    await T.terima(B, d1, meet);
    let x = await deal(d1);
    ok(x.status === "menunggu_bayar" && x.setor_b_at !== null && x.setor_a_at === null, "B menerima → menunggu pembayaran A");
    ok(x.cadangan > 0 && (await bal(B)) === b0 - x.fee_b - x.cadangan, `B menahan bea ${x.fee_b} + cadangan ${x.cadangan}`);
    ok((await deal(dC)).status === "proposed", "tawaran lain jadi antrian (tidak ditolak)");
    ok((await prisma.barterItem.findUniqueOrThrow({ where: { id: besar.id } })).status === "dalam_tukar", "barang terkunci");
    ok((await galat(() => T.setor(A, d1))).includes("QRIS"), "selisih tidak bisa dibayar dengan Keteng");

    // ---------- A setor lewat DOKU (selisih uang + bea) ----------
    const o1 = await setorDoku(A, d1);
    x = await deal(d1);
    ok(o1.rekber === 50_000 + R.BIAYA_TRANSFER && o1.tujuan_status === "berhasil", `tagihan: rekber ${o1.rekber} (uang, bukan Keteng)`);
    ok(x.status === "agreed" && x.selisih_status === "ditahan" && x.agreed_at !== null, "lunas → sepakat, selisih ditahan Kongsi");
    ok((await ditahan(d1, A)) === x.fee_a, "A menahan bea (Keteng)");
    ok(x.selisih_biaya_doku > 0, `bagian biaya DOKU atas selisih tercatat (${x.selisih_biaya_doku})`);

    // ---------- COD selesai ----------
    const bSebelum = await bal(B);
    await T.pindai(B, d1, T.kodeKetemu(d1, "a", x.agreed_at!));
    await T.pindai(A, d1, T.kodeKetemu(d1, "b", x.agreed_at!));
    x = await deal(d1);
    const tr1 = await transfer(d1);
    ok(x.status === "done" && x.selisih_status === "dicairkan", "dua pindaian → selesai, selisih dicairkan");
    ok(tr1.length === 1 && tr1[0].jenis === "pencairan_selisih" && tr1[0].user_id === B && tr1[0].nominal === 50_000, "transfer selisih utuh ke rekening B");
    ok(tr1[0].tenggat.getTime() > Date.now() + 24 * 3600_000, "tenggat pencairan ≥ 2 hari kerja");
    ok((await bal(B)) === bSebelum + x.cadangan && (await ditahan(d1, B)) === 0, "cadangan B kembali, bea B diambil");
    ok((await deal(dC)).status === "rejected", "tawaran antrian ditolak setelah barang ditukar");

    // ---------- Batal: penerima selisih bersalah → pembayar kembali utuh ----------
    const p1 = await item(A, "Jam Tangan", 100_000);
    const p2 = await item(B, "Speaker", 150_000);
    const dR = await T.ajukan(A, p1.id, p2.id, 50_000);
    await T.terima(B, dR, meet);
    await setorDoku(A, dR);
    const bR = await bal(B);
    await T.batalDiTempat(B, dR, "berubah pikiran");
    x = await deal(dR);
    const trR = (await transfer(dR))[0];
    ok(x.status === "cancelled" && x.fault_party === "b" && x.selisih_status === "dikembalikan", "B membatalkan → B penyebab");
    ok(trR?.jenis === "refund_selisih" && trR.user_id === A && trR.nominal === 50_000 + R.BIAYA_TRANSFER + x.selisih_biaya_doku,
      `A kembali utuh: selisih + biaya transfer + biaya DOKU = ${trR?.nominal}`);
    ok((await bal(B)) === bR + (x.cadangan - R.BIAYA_TRANSFER - x.selisih_biaya_doku), "bea B hangus; cadangan B menutup biaya pengembalian, sisanya kembali");
    ok((await prisma.sanksiTukar.count({ where: { user_id: B, deal_id: dR } })) === 1, "B dicatat pelanggaran");

    // ---------- Batal: pembayar selisih bersalah → dipotong biaya transfer ----------
    const p3 = await item(A, "Gitar", 100_000);
    const p4 = await item(C, "Ukulele", 150_000);
    const dP = await T.ajukan(A, p3.id, p4.id, 50_000);
    await T.terima(C, dP, meet);
    await setorDoku(A, dP);
    const cP = await bal(C);
    await T.batalDiTempat(A, dP, "tidak jadi");
    x = await deal(dP);
    const trP = (await transfer(dP))[0];
    ok(x.fault_party === "a" && trP.nominal === 50_000, "A membatalkan → A kembali selisih saja (biaya transfer & DOKU tidak kembali)");
    ok((await bal(C)) === cP + x.fee_b + x.cadangan, "jaminan C kembali utuh");

    // ---------- Barang tidak sesuai (COD) → pemilik barang = penyebab, tanpa bea hangus ----------
    const p5 = await item(A, "Sepatu", 100_000);
    const p6 = await item(C, "Tas", 150_000);
    const dS = await T.ajukan(A, p5.id, p6.id, 50_000);
    await T.terima(C, dS, meet);
    await setorDoku(A, dS);
    const aS = await bal(A);
    await T.batalDiTempat(A, dS, "tas sobek, beda dengan foto", true);
    x = await deal(dS);
    const trS = (await transfer(dS))[0];
    ok(x.fault_party === "b" && trS.nominal === 50_000 + R.BIAYA_TRANSFER + x.selisih_biaya_doku, "barang C tidak sesuai → A kembali utuh");
    ok((await bal(A)) === aS + x.fee_a && (await prisma.sanksiTukar.count({ where: { user_id: C, deal_id: dS, jenis: "barang_tidak_sesuai" } })) === 1,
      "bea A kembali; C dicatat 'barang tidak sesuai'");

    // ---------- Tidak bayar sebelum tenggat ----------
    const p7 = await item(A, "Raket", 100_000);
    const p8 = await item(C, "Bola", 100_000);
    const dT = await T.ajukan(A, p7.id, p8.id, 0);
    const cT = await bal(C);
    await T.terima(C, dT, meet);
    await prisma.barterDeal.update({ where: { id: dT }, data: { expires_at: new Date(Date.now() - 1000) } });
    await T.majukanTukar();
    x = await deal(dT);
    ok(x.status === "expired" && x.fault_party === "a", "A tidak menyetor → kedaluwarsa, A penyebab");
    ok((await bal(C)) === cT && (await prisma.sanksiTukar.count({ where: { user_id: A, deal_id: dT, jenis: "tidak_bayar" } })) === 1,
      "jaminan C kembali utuh; A dicatat 'tidak bayar'");

    // ---------- Pengaju lebih mahal meminta selisih: penerima selisih menahan cadangan dulu ----------
    const q1 = await item(A, "Monitor", 150_000);
    const q2 = await item(C, "Keyboard", 100_000);
    const dQ = await T.ajukan(A, q1.id, q2.id, 50_000);
    await T.terima(C, dQ, meet);
    x = await deal(dQ);
    ok(x.setor_b_at === null && R.giliranSetor(x) === "a", "C (pembayar) menunggu A menahan cadangan dulu");
    ok((await galat(() => L.mulaiBayarLangsung(akun(C), "tukar_setor", { dealId: dQ }, "kurang", "VIRTUAL_ACCOUNT_BRI", SITE))).includes("Menunggu"),
      "C belum bisa membayar sebelum giliran");
    await T.setor(A, dQ);
    x = await deal(dQ);
    ok(x.setor_a_at !== null && R.giliranSetor(x) === "b" && x.status === "menunggu_bayar", "A menahan bea + cadangan → giliran C");
    ok((await ditahan(dQ, A)) === x.fee_a + x.cadangan, "jaminan A = bea + cadangan");
    ok((await galat(() => L.mulaiBayarLangsung(akun(C), "tukar_setor", { dealId: dQ }, "kurang", "CREDIT_CARD", SITE))) !== "", "selisih tidak bisa dibayar dengan kartu");
    await setorDoku(C, dQ);
    x = await deal(dQ);
    ok(x.status === "agreed" && x.selisih_status === "ditahan", "C membayar selisih → sepakat");

    // ---------- Mundur saat menunggu bayar ----------
    const r1 = await item(A, "Kipas", 100_000);
    const r2 = await item(C, "Lampu", 100_000);
    const dM = await T.ajukan(A, r1.id, r2.id, 0);
    await T.terima(C, dM, meet);
    const cM = await bal(C);
    await T.batalMenunggu(C, dM, "salah pencet");
    x = await deal(dM);
    ok(x.status === "cancelled" && x.fault_party === "b" && (await bal(C)) === cM, "C mundur setelah menerima → bea C hangus");

    // ---------- Pembayaran terlambat: tujuan gagal → uang selisih dikembalikan (dipotong biaya transfer) ----------
    const s1 = await item(A, "Termos", 100_000);
    const s2 = await item(C, "Botol", 150_000);
    const dL = await T.ajukan(A, s1.id, s2.id, 50_000);
    await T.terima(C, dL, meet);
    const rL = await L.mulaiBayarLangsung(akun(A), "tukar_setor", { dealId: dL }, "penuh", "VIRTUAL_ACCOUNT_BRI", SITE);
    ok((await galat(() => T.batalMenunggu(C, dL, "kelamaan"))).includes("diproses"), "tidak bisa mundur saat ada pembayaran berjalan");
    await prisma.topupOrder.update({ where: { invoice_number: rL.invoice }, data: { expires_at: new Date(Date.now() - 20 * 60_000) } });
    await T.batalMenunggu(C, dL, "kelamaan");
    const oL = await prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: rL.invoice } });
    const aL = await bal(A);
    await Bayar.prosesLunas(rL.invoice, oL.price, "VA");
    const trL = await prisma.transferKeluar.findFirst({ where: { ref: rL.invoice } });
    ok(trL?.jenis === "refund_selisih" && trL.nominal === oL.rekber - R.BIAYA_TRANSFER && (await bal(A)) === aL + oL.keteng,
      "bayar setelah batal → selisih dikembalikan (dipotong biaya transfer), Keteng masuk Pundi");

    // ---------- Syahbandar ----------
    const t1 = await item(A, "Rak", 100_000);
    const t2 = await item(B, "Meja", 100_000);
    const dY = await T.ajukan(A, t1.id, t2.id, 0);
    await T.terima(B, dY, meet);
    await T.setor(A, dY);
    ok((await galat(() => T.sengketa(A, dY, "tidak datang ke titik aman", null))).includes("foto"), "sengketa wajib foto bukti");
    await T.sengketa(A, dY, "tidak datang ke titik aman", "/uploads/sengketa/uji.jpg");
    ok((await galat(() => T.putus(A, dY, "batal", "b", "tidak datang terbukti"))).includes("sendiri"), "pihak deal tidak bisa memutus sengketanya");
    ok((await galat(() => T.putus(ADMIN, dY, "batal", "b", "pendek"))).includes("alasan"), "alasan putusan wajib");
    const bY = await bal(B);
    await T.putus(ADMIN, dY, "batal", "b", "B tidak datang, terbukti dari foto");
    x = await deal(dY);
    ok(x.status === "resolved" && x.putus_oleh === ADMIN && x.fault_party === "b" && (await bal(B)) === bY, "batal, B bersalah → bea B hangus, putusan tercatat");

    // ---------- 3 pelanggaran dalam 30 hari → diblokir ----------
    ok((await T.blokirSampai(prisma, B)) === null, "2 pelanggaran belum memblokir");
    const nC = await prisma.sanksiTukar.count({ where: { user_id: C } });
    ok(nC >= 3 && (await T.blokirSampai(prisma, C)) !== null, `C punya ${nC} catatan → diblokir`);
    const u1 = await item(C, "Payung", 100_000);
    const u2 = await item(A, "Topi", 100_000);
    ok((await galat(() => T.ajukan(C, u1.id, u2.id, 0))).includes("tidak bisa ikut"), "yang diblokir tidak bisa mengajukan");

    // ---------- Maks 3 tawaran menunggu ----------
    const v = await Promise.all([1, 2, 3, 4].map((i) => item(B, `Barang B${i}`, 100_000)));
    const tgt = await Promise.all([1, 2, 3, 4].map((i) => item(A, `Target A${i}`, 100_000)));
    for (let i = 0; i < 3; i++) await T.ajukan(B, v[i].id, tgt[i].id, 0);
    ok((await galat(() => T.ajukan(B, v[3].id, tgt[3].id, 0))).includes("Maksimal 3"), "tawaran ke-4 yang menunggu ditolak");

    for (const u of [A, B, C]) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: u }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(u)), `Σ transaksi = saldo (${u})`);
    }
  } finally {
    const inv = (await prisma.topupOrder.findMany({ where: { user_id: { in: ids } }, select: { invoice_number: true } })).map((o) => o.invoice_number);
    await prisma.pembayaranBermasalah.deleteMany({ where: { invoice: { in: inv } } });
    await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.barterItem.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.walletHold.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
