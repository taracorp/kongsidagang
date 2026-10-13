// Uji Fase 3 — setoran lapak, laporan pembeli, pengembalian, pindah cabang (DOKU tiruan) di kongsi_dev:
//   npx tsx --conditions=react-server scripts/uji/setoran.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const B = await import("@/lib/domain/belanja");
  const S = await import("@/lib/domain/setoran");
  const Tr = await import("@/lib/domain/transfer");
  const Rek = await import("@/lib/domain/rekening");
  const Bayar = await import("@/lib/domain/pembayaran");
  const { BIAYA_TRANSFER } = await import("@/lib/domain/tukar-aturan");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message || "galat"; } };

  const ids = ["uji-setor-pembeli", "uji-setor-pemilik", "uji-setor-admin"];
  const [U, OW, ADMIN] = ids;
  const SLUG = "uji-setoran-lapak";
  const bersih = async () => {
    const m = await prisma.merchant.findUnique({ where: { slug: SLUG }, select: { id: true } });
    await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
    if (m) {
      await prisma.potonganLapak.deleteMany({ where: { merchant_id: m.id } });
      await prisma.setoranLapak.deleteMany({ where: { merchant_id: m.id } });
      await prisma.komplainVoucher.deleteMany({ where: { user_id: U } });
      await prisma.voucher.deleteMany({ where: { merchant_id: m.id } });
      await prisma.orderItem.deleteMany({ where: { merchant_id: m.id } });
      await prisma.merchant.delete({ where: { id: m.id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };
  await bersih();
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const m = await prisma.merchant.create({
    data: {
      slug: SLUG,
      name: "Lapak Uji Setoran",
      category: "kecantikan",
      owner_id: OW,
      status: "buka",
      branches: { create: [{ name: "Cabang Satu", address: "Jl. Satu" }, { name: "Cabang Dua", address: "Jl. Dua", sort: 1 }, { name: "Cabang Tutup", address: "Jl. Tiga", sort: 2, is_active: false }] },
      products: { create: [{ name: "Facial Uji", price: 100_000, kind: "evoucher", valid_days: 90 }] },
    },
    include: { branches: { orderBy: { sort: "asc" } }, products: true },
  });
  const [c1, c2, c3] = m.branches;
  const prod = m.products[0];
  const akun = { id: U, name: U, email: `${U}@uji.local` };
  async function beli(qty: number) {
    const r = await B.mulaiBelanja(akun, [{ productId: prod.id, branchId: c1.id, qty }], "VIRTUAL_ACCOUNT_BRI", "https://kongsidagang.store");
    const o = await prisma.order.findUniqueOrThrow({ where: { invoice_number: r.invoice } });
    await Bayar.prosesLunas(r.invoice, o.total, "VA");
    return { order: o, vouchers: await prisma.voucher.findMany({ where: { orderItem: { order_id: o.id } }, orderBy: { created_at: "asc" } }) };
  }
  const v = (id: string) => prisma.voucher.findUniqueOrThrow({ where: { id } });
  const ringkas = async () => (await S.ringkasanLapak([m.id]))[0];

  try {
    const { order, vouchers } = await beli(4);
    const [v1, v2, v3, v4] = vouchers;
    ok(vouchers.length === 4 && vouchers.every((x) => x.status === "aktif"), "4 voucher terbit");
    let r = await ringkas();
    ok(r.aktif === 400_000 && r.siapSetor === 0, "voucher aktif belum boleh disetor");

    // Pindah cabang
    ok((await galat(() => S.pindahCabang(U, v1.id, c3.id))).includes("tidak tersedia"), "tidak bisa pindah ke cabang nonaktif");
    ok((await galat(() => S.pindahCabang(OW, v1.id, c2.id))) !== "", "orang lain tidak bisa memindahkan voucher");
    await S.pindahCabang(U, v1.id, c2.id);
    ok((await v(v1.id)).branch_id === c2.id, "pembeli memindahkan voucher ke Cabang Dua (gratis)");

    // Tebus & kedaluwarsa
    await B.tebusVoucherLapak(OW, m.id, c2.id, v1.code!);
    await B.tebusVoucherLapak(OW, m.id, c1.id, v2.code!);
    await prisma.voucher.update({ where: { id: v1.id }, data: { redeemed_at: new Date(Date.now() - 4 * 86_400_000) } });
    await prisma.voucher.update({ where: { id: v3.id }, data: { expires_at: new Date(Date.now() - 1000) } });
    await B.kadaluarsakanVoucher();
    r = await ringkas();
    ok(r.siapSetor === 200_000 && r.siapJumlah === 2, "siap setor: ditebus ≥ 3 hari (v1) + kedaluwarsa (v3)");
    ok(r.ditahan === 100_000, "ditebus < 3 hari (v2) masih ditahan");

    // Laporan: v4 aktif (cabang menolak) → diterima → pembeli kembali utuh, lapak dipotong
    ok((await galat(() => S.ajukanKomplain(U, v4.id, "pendek"))).includes("minimal"), "laporan wajib alasan");
    await S.ajukanKomplain(U, v4.id, "Petugas Cabang Satu menolak voucher saya");
    ok((await v(v4.id)).komplain_status === "terbuka", "laporan tercatat, voucher dibekukan");
    const k4 = await prisma.komplainVoucher.findFirstOrThrow({ where: { voucher_id: v4.id } });
    ok((await galat(() => S.putusKomplain(OW, k4.id, "tolak", "saya pemilik lapaknya"))).includes("dirimu"), "pemilik lapak tidak bisa memutus laporannya");
    await S.putusKomplain(ADMIN, k4.id, "terima", "Lapak mengakui menolak voucher yang sah");
    const fee = Math.round(order.bea / 4), doku = Math.round(order.biaya_bayar / 4);
    const tr4 = await prisma.transferKeluar.findFirstOrThrow({ where: { ref: v4.id } });
    ok((await v(v4.id)).status === "dikembalikan" && tr4.jenis === "refund_belanja" && tr4.nominal === 100_000 + fee + doku,
      `pembeli kembali utuh ${tr4.nominal} (harga + platform fee + biaya DOKU)`);
    r = await ringkas();
    ok(r.potongan === fee + doku + BIAYA_TRANSFER, `potongan lapak ${r.potongan} (platform fee + biaya DOKU + transfer)`);

    // Laporan v2 (ditebus < 3 hari) → ditolak → kembali normal setelah 3 hari
    await S.ajukanKomplain(U, v2.id, "Sudah ditebus tapi belum dilayani");
    const k2 = await prisma.komplainVoucher.findFirstOrThrow({ where: { voucher_id: v2.id } });
    await S.putusKomplain(ADMIN, k2.id, "tolak", "Lapak menunjukkan bukti layanan selesai");
    ok((await v(v2.id)).komplain_status === "ditolak", "laporan ditolak");
    await prisma.voucher.update({ where: { id: v2.id }, data: { redeemed_at: new Date(Date.now() - 4 * 86_400_000) } });
    ok((await galat(() => S.ajukanKomplain(U, v2.id, "melapor lagi setelah ditolak"))) !== "", "tidak bisa melapor dua kali");

    // Setoran
    ok((await galat(() => S.buatSetoran(ADMIN, m.id))).includes("rekening"), "setoran butuh rekening lapak");
    await S.simpanRekeningLapak(m.id, { bank: "BCA", nomor: "9988776655", atas_nama: "Lapak Uji" });
    ok((await galat(() => S.buatSetoran(OW, m.id))).includes("sendiri"), "pemilik lapak tidak bisa membuat setoran sendiri");
    const st = await S.buatSetoran(ADMIN, m.id);
    ok(st.nominal_kotor === 300_000 && st.potongan === fee + doku + BIAYA_TRANSFER && st.nominal === 300_000 - st.potongan && st.jumlah_voucher === 3,
      `setoran ${st.nominal} = 3 voucher − potongan`);
    ok((await v(v4.id)).setoran_id === null, "voucher yang dikembalikan tidak ikut disetor");
    ok((await galat(() => S.buatSetoran(ADMIN, m.id))).includes("Belum ada"), "tidak ada setoran ganda");
    const trS = await prisma.transferKeluar.findFirstOrThrow({ where: { ref: st.id } });
    ok(trS.jenis === "setoran_lapak" && trS.merchant_id === m.id && trS.nominal === st.nominal, "setoran masuk antrian transfer (rekening lapak)");
    ok((await galat(() => Tr.tandaiDibayar(OW, trS.id, "REF123"))).includes("dirimu"), "pemilik tidak bisa menandai transfernya sendiri");
    await Tr.tandaiDibayar(ADMIN, trS.id, "BCA-REF-001");
    const trS2 = await prisma.transferKeluar.findUniqueOrThrow({ where: { id: trS.id } });
    ok(trS2.status === "dibayar" && trS2.nomor === "9988776655" && (await prisma.setoranLapak.findUniqueOrThrow({ where: { id: st.id } })).status === "dibayar",
      "transfer dibayar ke rekening lapak; setoran ditandai dibayar");
    ok((await galat(() => S.ajukanKomplain(U, v1.id, "melapor setelah disetor"))) !== "", "voucher yang sudah disetor tidak bisa dilaporkan");
    ok((await galat(() => Tr.tandaiDibayar(ADMIN, tr4.id, "REF-REFUND"))).includes("rekening"), "pengembalian menunggu pembeli mengisi rekening");
    await Rek.simpanRekening(U, { bank: "BRI", nomor: "1122334455", atas_nama: "Pembeli Uji" });
    await Tr.tandaiDibayar(ADMIN, tr4.id, "BRI-REF-002");
    ok((await prisma.transferKeluar.findUniqueOrThrow({ where: { id: tr4.id } })).nomor === "1122334455", "pengembalian ditransfer ke rekening pembeli");

    // Pengembalian tanpa laporan (cabang tutup permanen)
    const { vouchers: [v5] } = await beli(1);
    ok((await galat(() => S.kembalikanVoucher(OW, v5.code!, "cabang tutup permanen sejak kemarin"))).includes("dirimu"), "pemilik lapak tidak bisa mengembalikan sendiri");
    const r5 = await S.kembalikanVoucher(ADMIN, v5.code!, "Cabang Satu tutup permanen");
    ok((await v(v5.id)).status === "dikembalikan" && r5.potongan > BIAYA_TRANSFER, "voucher aktif dikembalikan; potongan dicatat");
    ok((await galat(() => B.tebusVoucherLapak(OW, m.id, c1.id, v5.code!))) !== "", "voucher yang dikembalikan tidak bisa ditebus");
    r = await ringkas();
    ok(r.potongan === r5.potongan && r.siapSetor === 0, "potongan baru menunggu setoran berikutnya");
  } finally {
    await bersih();
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
