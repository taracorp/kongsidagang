// Uji mode Kirim (driver tiruan) di kongsi_dev: npx tsx --conditions=react-server scripts/uji/kirim.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.ENABLE_TOPUP_DEMO = "true";
process.env.KIRIMINAJA_MOCK = "true";
delete process.env.KIRIMINAJA_API_KEY;

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const T = await import("@/lib/domain/tukar");
  const K = await import("@/lib/domain/tukar-kirim");
  const AL = await import("@/lib/domain/alamat");
  const R = await import("@/lib/domain/tukar-aturan");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const gagal = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

  const ids = ["uji-kirim-a", "uji-kirim-b"];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const [A, B] = ids;
  const bal = async (u: string) => (await prisma.wallet.findUnique({ where: { user_id: u } }))?.balance ?? 0;
  const deal = (id: string) => prisma.barterDeal.findUniqueOrThrow({ where: { id }, include: { shipments: true } });
  const item = (user_id: string, title: string, est_value: number, category: string, kg: number) =>
    prisma.barterItem.create({ data: { user_id, title, est_value, category, ship_weight_kg: kg, status: "aktif" } });
  const alamat = (u: string, area: string, district_id: number, subdistrict_id: number) =>
    AL.simpanAlamat(u, { label: "Rumah", name: u, phone: "081234567890", address: "Jl. Uji No. 1 RT 01/02", area, district_id, subdistrict_id, lat: -7.7, lng: 110.4 });

  try {
    ok(R.depositKirim(20_000) === 5_000 && R.depositKirim(1_000_000) === 100_000 && R.depositKirim(5_000_000) === 200_000, "deposit 10% min 5rb maks 200rb");
    ok(K.paketUntuk({ title: "s", est_value: 1, ship_weight_kg: 15, categoryRef: { kind: "aset", ship_length_cm: 140, ship_width_cm: 20, ship_height_cm: 75 } }).length_cm === 140, "dimensi aset dari kategori");
    const kom = K.paketUntuk({ title: "b", est_value: 1, ship_weight_kg: 100, categoryRef: { kind: "komoditas", ship_length_cm: null, ship_width_cm: null, ship_height_cm: null } });
    ok(kom.weight_g === 100_000 && kom.length_cm === 85, `komoditas 100kg → kubus ${kom.length_cm}cm`);
    ok(await gagal(() => alamat(A, "Sariharjo, Ngaglik, Sleman, DI Yogyakarta, 55581", 0, 0)), "alamat tanpa kelurahan ditolak");
    ok(await gagal(() => AL.simpanAlamat(A, { label: "", name: "A", phone: "12345", address: "Jl. Uji 1", area: "x, 55581", district_id: 1, subdistrict_id: 1, lat: -7, lng: 110 })), "HP tidak valid ditolak");
    ok((await AL.cariWilayah(A, "sleman")).length === 2, "cari wilayah (tiruan)");

    const adrA = await alamat(A, "Sariharjo, Ngaglik, Sleman, DI Yogyakarta, 55581", 5788, 31554);
    const adrB = await alamat(B, "Sawojajar, Kedungkandang, Kota Malang, Jawa Timur, 65139", 3635, 46740);
    for (const u of ids) { await P.topupDemo(u, "270000"); await P.topupDemo(u, "270000"); } // 540rb
    const buku = await item(A, "Buku Uji Kirim", 200_000, "buku", 0.5);
    const hp = await item(B, "HP Uji Kirim", 200_000, "hp", 0.5);

    ok(await gagal(() => T.ajukan(A, buku.id, hp.id, 0, { mode: "kirim" })), "mode Kirim tanpa alamat ditolak");
    const d1 = await T.ajukan(A, buku.id, hp.id, 0, { mode: "kirim", addressId: adrA });
    ok((await bal(A)) === 540_000 - 10_000 - 20_000, "A menahan bea 10rb + deposit 20rb");
    ok(await gagal(() => K.terimaKirim(B, d1, adrA)), "B tidak bisa memakai alamat A");
    await K.terimaKirim(B, d1, adrB);
    let x = await deal(d1);
    const ab = x.shipments.find((s) => s.leg === "a_to_b")!;
    const ba = x.shipments.find((s) => s.leg === "b_to_a")!;
    const ongkirB = ab.shipping_cost + ab.insurance, ongkirA = ba.shipping_cost + ba.insurance;
    ok(x.status === "agreed" && ab.status === "paid" && ba.status === "quoted", "B menerima: paket A→B lunas (dibayar B), B→A belum");
    ok((await bal(B)) === 540_000 - 10_000 - 20_000 - ongkirB, `B menahan bea + deposit + ongkir ${ongkirB}`);
    ok(await gagal(() => T.pindai(A, d1, "123456")), "pindai COD ditolak di mode Kirim");

    await K.bayarOngkir(A, d1);
    x = await deal(d1);
    ok(x.status === "dikirim" && x.shipments.every((s) => s.status === "requested" && s.order_id && s.awb), "dua lunas → dua order dibuat → dikirim");
    ok(x.shipments.every((s) => (s.order_id ?? "").length <= 20), "order_id ≤ 20 karakter");
    const holdsOngkir = await prisma.walletHold.findMany({ where: { deal_id: d1, kind: "ongkir" } });
    ok(holdsOngkir.length === 2 && holdsOngkir.every((h) => h.status === "diambil"), "ongkir rekber diambil (dibayar ke kurir)");
    ok(await gagal(() => T.batalDiTempat(A, d1, "berubah pikiran")), "tidak bisa batal sepihak setelah paket dibuat");
    ok((await K.kirimkanPaket(d1)).dibuat === 0, "panggilan ulang tidak membuat order dobel");

    // Webhook: A→B jalan, sampai; B→A jalan, sampai
    const oAB = x.shipments.find((s) => s.leg === "a_to_b")!.order_id!;
    const oBA = x.shipments.find((s) => s.leg === "b_to_a")!.order_id!;
    await K.prosesWebhook("shipped_packages", [{ order_id: oAB, awb: "AWB1", shipped_at: new Date().toISOString() }]);
    await K.prosesWebhook("finished_packages", [{ order_id: oAB, finished_at: new Date().toISOString() }]);
    ok((await deal(d1)).status === "dikirim", "satu paket sampai → masih dikirim");
    await K.prosesWebhook("shipped_packages", [{ order_id: oBA }]);
    await K.prosesWebhook("finished_packages", [{ order_id: oBA }]);
    await K.prosesWebhook("shipped_packages", [{ order_id: oBA }]); // callback terlambat
    x = await deal(d1);
    ok(x.status === "diterima" && x.shipments.every((s) => s.status === "delivered"), "dua paket sampai → diterima (status tidak mundur)");
    const a1 = await bal(A), b1 = await bal(B);
    ok((await T.konfirmasi({ userId: A }, d1)).done === false, "konfirmasi A saja belum selesai");
    ok((await T.konfirmasi({ userId: B }, d1)).done === true, "konfirmasi B → selesai");
    ok((await bal(A)) === a1 + 20_000 && (await bal(B)) === b1 + 20_000, "deposit kembali ke kedua pihak");
    ok((await prisma.walletHold.count({ where: { deal_id: d1, status: "ditahan" } })) === 0, "tidak ada rekber tersisa");

    // Kedaluwarsa: A tidak bayar ongkir dalam 12 jam
    const buku2 = await item(A, "Buku Uji Kirim 2", 50_000, "buku", 0.5);
    const kaos2 = await item(B, "Kaos Uji Kirim 2", 50_000, "fashion", 1);
    const a0 = await bal(A), b0 = await bal(B);
    const d2 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d2, adrB);
    await prisma.barterDeal.update({ where: { id: d2 }, data: { expires_at: new Date(Date.now() - 1000) } });
    const r2 = await T.majukanTukar();
    x = await deal(d2);
    ok(r2.kedaluwarsa >= 1 && x.status === "expired" && x.fault_party === "a", "ongkir tak dilunasi → kedaluwarsa, penyebab A");
    ok((await bal(A)) === a0 && (await bal(B)) === b0, "semua rekber (termasuk ongkir B) kembali");

    // Penahanan silang: A kirim, B tidak menyerahkan paket 48 jam
    const d3 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d3, adrB);
    await K.bayarOngkir(A, d3);
    x = await deal(d3);
    const s3 = x.shipments.find((s) => s.leg === "a_to_b")!;
    await K.prosesWebhook("shipped_packages", [{ order_id: s3.order_id! }]);
    await prisma.barterShipment.update({ where: { id: s3.id }, data: { shipped_at: new Date(Date.now() - 49 * 3600_000) } });
    const r3 = await T.majukanTukar();
    x = await deal(d3);
    ok(r3.sengketa >= 1 && x.status === "disputed" && x.fault_party === "b", "penahanan silang → Syahbandar, penyebab B");
    ok((await prisma.walletHold.count({ where: { deal_id: d3, kind: "deposit", status: "ditahan" } })) === 2, "deposit tetap ditahan menunggu putusan");

    // Paket bermasalah → Syahbandar
    await T.putus(d3, "batal");
    const d4 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d4, adrB);
    await K.bayarOngkir(A, d4);
    const o4 = (await deal(d4)).shipments[0].order_id!;
    await K.prosesWebhook("problem_packages", [{ order_id: o4, reason: "Alamat tidak ditemukan" }]);
    x = await deal(d4);
    ok(x.status === "disputed" && (x.cancel_reason ?? "").includes("Alamat tidak ditemukan"), "paket bermasalah → Syahbandar dengan alasan kurir");

    // --- Pengaman uang platform: batal setelah order dibuat di kurir
    const leg = async (id: string, l: string) => (await deal(id)).shipments.find((s) => s.leg === l)!;
    const ongkirLeg = (s: { shipping_cost: number; insurance: number }) => s.shipping_cost + s.insurance;
    const mundur = (id: string) => prisma.$executeRaw`UPDATE barter_shipments SET updated_at = now() - interval '10 minutes' WHERE deal_id = ${id}`;

    // (a) Syahbandar batal: paket B→A belum dijemput → perlu_batal; ongkir A kembali HANYA setelah kurir memastikan batal
    const l4 = (await deal(d4)).shipments.find((s) => s.status === "requested")!.leg; // paket yang tidak bermasalah
    await T.putus(d4, "batal");
    const s4 = await leg(d4, l4);
    ok(s4.status === "perlu_batal", "batal → paket yang sudah di kurir ditandai perlu_batal");
    const p4 = s4.payer_id, saldo4 = await bal(p4);
    // d3 (dibatalkan Syahbandar di atas) juga punya paket yang belum dijemput milik pembayar yang sama.
    const antre = await prisma.barterShipment.findMany({ where: { payer_id: p4, status: "perlu_batal", deal_id: { in: [d3, d4] } } });
    const kembali4 = antre.reduce((t, x) => t + ongkirLeg(x), 0);
    process.env.KIRIMINAJA_MOCK_BATAL = "pending";
    await K.rekonsiliasiPaket();
    ok((await leg(d4, l4)).status === "perlu_batal" && (await bal(p4)) === saldo4, "kurir masih memproses → belum ada pengembalian");
    process.env.KIRIMINAJA_MOCK_BATAL = "success";
    await K.rekonsiliasiPaket();
    ok((await leg(d4, l4)).status === "canceled" && (await bal(p4)) === saldo4 + kembali4, `kurir memastikan batal → ongkir kembali ke pembayarnya (${antre.length} paket)`);
    await K.rekonsiliasiPaket();
    await K.prosesWebhook("canceled_packages", [{ order_id: s4.order_id! }]);
    ok((await bal(p4)) === saldo4 + kembali4, "rekonsiliasi/webhook ulang tidak mengembalikan dobel");

    // (b) Kurir menolak pembatalan (sudah dijemput) → ongkir hangus (menutup KA Credit), tidak dikembalikan
    const d5 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d5, adrB);
    await K.bayarOngkir(A, d5);
    await K.prosesWebhook("problem_packages", [{ order_id: (await leg(d5, "a_to_b")).order_id!, reason: "Uji" }]);
    await T.putus(d5, "batal");
    const s5 = await leg(d5, "b_to_a"), saldo5 = await bal(s5.payer_id);
    process.env.KIRIMINAJA_MOCK_BATAL = "tolak";
    await K.rekonsiliasiPaket();
    ok((await leg(d5, "b_to_a")).status === "batal_gagal" && (await bal(s5.payer_id)) === saldo5, "kurir menolak batal → batal_gagal, ongkir hangus");
    delete process.env.KIRIMINAJA_MOCK_BATAL;

    // (c) Jawaban buatOrder hilang → perlu_cek, order_id dipertahankan, ongkir belum diambil; dipastikan lewat lacak
    const d6 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d6, adrB);
    process.env.KIRIMINAJA_MOCK_ORDER = "putus";
    await K.bayarOngkir(A, d6);
    delete process.env.KIRIMINAJA_MOCK_ORDER;
    x = await deal(d6);
    ok(x.status === "agreed" && x.shipments.every((s) => s.status === "perlu_cek" && s.order_id), "galat jaringan → perlu_cek, order_id disimpan");
    ok((await prisma.walletHold.count({ where: { deal_id: d6, kind: "ongkir", status: "ditahan" } })) === 2, "ongkir belum diambil selama belum pasti");
    ok((await K.kirimkanPaket(d6)).dibuat === 0, "perlu_cek tidak dibuat ulang (tidak ada order dobel)");
    await K.rekonsiliasiPaket();
    ok((await deal(d6)).shipments.every((s) => s.status === "perlu_cek"), "rekonsiliasi menunggu 5 menit (tidak mendahului order yang masih berjalan)");
    await mundur(d6);
    await K.rekonsiliasiPaket();
    x = await deal(d6);
    ok(x.status === "dikirim" && x.shipments.every((s) => s.status === "requested"), "lacak: order ada → requested, deal dikirim");
    ok((await prisma.walletHold.count({ where: { deal_id: d6, kind: "ongkir", status: "diambil" } })) === 2, "ongkir baru diambil setelah order pasti ada");
    await K.prosesWebhook("problem_packages", [{ order_id: x.shipments[0].order_id!, reason: "Uji" }]);
    process.env.KIRIMINAJA_MOCK_BATAL = "success";
    await T.putus(d6, "batal");
    await K.rekonsiliasiPaket();
    delete process.env.KIRIMINAJA_MOCK_BATAL;

    // (d) Order ternyata tidak terbentuk → failed, boleh dicoba lagi; deal lewat batas → batal, ongkir kembali utuh
    const a7 = await bal(A), b7 = await bal(B);
    const d7 = await T.ajukan(A, buku2.id, kaos2.id, 0, { mode: "kirim", addressId: adrA });
    await K.terimaKirim(B, d7, adrB);
    process.env.KIRIMINAJA_MOCK_ORDER = "putus";
    await K.bayarOngkir(A, d7);
    delete process.env.KIRIMINAJA_MOCK_ORDER;
    await mundur(d7);
    process.env.KIRIMINAJA_MOCK_LACAK = "hilang";
    await K.rekonsiliasiPaket();
    x = await deal(d7);
    ok(x.shipments.every((s) => s.status === "failed" && !s.order_id), "lacak: tidak ditemukan → failed (boleh dicoba lagi)");
    await prisma.barterDeal.update({ where: { id: d7 }, data: { expires_at: new Date(Date.now() - 1000) } });
    await T.majukanTukar();
    delete process.env.KIRIMINAJA_MOCK_LACAK;
    x = await deal(d7);
    ok(x.status === "expired" && x.shipments.every((s) => s.status === "canceled"), "lewat batas → batal, paket failed ikut dibatalkan");
    ok((await prisma.walletHold.count({ where: { deal_id: d7, status: "ditahan" } })) === 0 && (await bal(A)) === a7 && (await bal(B)) === b7,
      "semua rekber d7 kembali utuh (order tak pernah terbentuk → tidak ada biaya kurir)");

    for (const u of ids) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: u }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(u)), `Σ transaksi = saldo (${u})`);
    }
  } finally {
    await prisma.barterItem.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.walletHold.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
