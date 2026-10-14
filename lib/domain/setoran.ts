import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Tx } from "@/lib/domain/pundi";
import { beriKabar, kabariPengurus } from "@/lib/domain/kabar-user";
import { antrikanTransfer } from "@/lib/domain/transfer";
import { rapikanRekening, type RekeningInput } from "@/lib/domain/rekening";
import { BIAYA_TRANSFER, HARI_KERJA_PENCAIRAN, tambahHariKerja } from "@/lib/domain/tukar-aturan";

// Setoran lapak & refund belanja (Fase 3, Ch 8.37). Prinsip: Kongsi tidak pernah membayar duluan.
// - Titipan (harga voucher) baru disetor ke lapak bila voucher DITEBUS ≥ 3 hari tanpa komplain, atau KEDALUWARSA
//   (pembeli lalai → uang untuk lapak). Voucher aktif tidak pernah disetor.
// - Lapak gagal melayani (komplain terbukti / menolak voucher sah / cabang tutup) → pembeli dikembalikan UTUH lewat
//   transfer (harga + bagian platform fee + bagian biaya DOKU). Harga tidak pernah disetor; platform fee, biaya DOKU,
//   dan biaya transfer dicatat sebagai potongan setoran lapak itu.
// - Pembeli boleh pindah cabang (gratis) selama voucher aktif.

export const HARI_TAHAN_SETOR = 3; // jeda setelah ditebus: kesempatan pembeli komplain
const HARI = 86_400_000;

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
/** Hak lapak per voucher: titipan (lelang: harga deal) atau harga jual. */
const hakLapak = (i: { unit_price: number; titipan: number | null } | null) => (i ? (i.titipan ?? i.unit_price) : 0);

/** Voucher lapak yang boleh disetor (filter Prisma). */
export function syaratSiapSetor(now = new Date()): Prisma.VoucherWhereInput {
  return {
    order_item_id: { not: null },
    setoran_id: null,
    OR: [{ komplain_status: null }, { komplain_status: "ditolak" }],
    AND: [
      {
        OR: [
          { status: "terpakai", redeemed_at: { lte: new Date(now.getTime() - HARI_TAHAN_SETOR * HARI) } },
          { status: "kadaluarsa" },
        ],
      },
    ],
  };
}

// ============================================================
// Rekening lapak
// ============================================================

export async function simpanRekeningLapak(merchantId: string, input: RekeningInput) {
  const r = rapikanRekening(input);
  const m = await prisma.merchant.update({
    where: { id: merchantId },
    data: { rek_bank: r.bank, rek_nomor: r.nomor, rek_atas_nama: r.atas_nama },
    select: { owner_id: true, name: true },
  });
  await beriKabar(prisma, m.owner_id, {
    kind: "sistem",
    title: `Rekening setoran ${m.name} diubah`,
    body: `${r.bank} ••••${r.nomor.slice(-4)} a.n. ${r.atas_nama}. Bukan kamu? Segera hubungi Kongsi.`,
    href: "/pakhuis/lapak",
  });
}

// ============================================================
// Ringkasan uang lapak
// ============================================================

export type RingkasanLapak = {
  merchantId: string;
  nama: string;
  rekening: string | null;
  aktif: number; // titipan voucher aktif (belum boleh disetor)
  ditahan: number; // ditebus < 3 hari / komplain terbuka
  siapSetor: number;
  siapJumlah: number;
  potongan: number; // potongan yang belum dipotong dari setoran
  sudahDisetor: number;
  antriSetor: number; // setoran dibuat, belum ditransfer
};

async function jumlahHarga(where: Prisma.VoucherWhereInput) {
  const v = await prisma.voucher.findMany({ where, select: { orderItem: { select: { unit_price: true, titipan: true } } } });
  return { total: v.reduce((t, x) => t + hakLapak(x.orderItem), 0), jumlah: v.length };
}

export async function ringkasanLapak(merchantIds?: string[]): Promise<RingkasanLapak[]> {
  const now = new Date();
  const merchants = await prisma.merchant.findMany({
    where: merchantIds ? { id: { in: merchantIds } } : { OR: [{ vouchers: { some: { order_item_id: { not: null } } } }, { potongan: { some: {} } }] },
    select: { id: true, name: true, rek_bank: true, rek_nomor: true, rek_atas_nama: true },
    orderBy: { name: "asc" },
  });
  const hasil: RingkasanLapak[] = [];
  for (const m of merchants) {
    const dasar = { merchant_id: m.id, order_item_id: { not: null } } as const;
    const [aktif, siap, ditahan, potongan, setoran] = await Promise.all([
      jumlahHarga({ ...dasar, status: "aktif" }),
      jumlahHarga({ merchant_id: m.id, ...syaratSiapSetor(now) }),
      jumlahHarga({
        ...dasar,
        setoran_id: null,
        OR: [
          { status: "terpakai", redeemed_at: { gt: new Date(now.getTime() - HARI_TAHAN_SETOR * HARI) } },
          { komplain_status: "terbuka" },
        ],
      }),
      prisma.potonganLapak.aggregate({ where: { merchant_id: m.id, setoran_id: null }, _sum: { nominal: true } }),
      prisma.setoranLapak.groupBy({ by: ["status"], where: { merchant_id: m.id }, _sum: { nominal: true } }),
    ]);
    hasil.push({
      merchantId: m.id,
      nama: m.name,
      rekening: m.rek_nomor ? `${m.rek_bank} ${m.rek_nomor} a.n. ${m.rek_atas_nama}` : null,
      aktif: aktif.total,
      ditahan: ditahan.total,
      siapSetor: siap.total,
      siapJumlah: siap.jumlah,
      potongan: potongan._sum.nominal ?? 0,
      sudahDisetor: setoran.find((s) => s.status === "dibayar")?._sum.nominal ?? 0,
      antriSetor: setoran.find((s) => s.status === "antri")?._sum.nominal ?? 0,
    });
  }
  return hasil;
}

// ============================================================
// Setoran
// ============================================================

/** Pengurus membuat setoran untuk satu lapak: semua voucher siap setor dikurangi potongan terbuka → antrian transfer. */
export async function buatSetoran(adminId: string, merchantId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM merchants WHERE id = ${merchantId} FOR UPDATE`;
    const m = await tx.merchant.findUnique({ where: { id: merchantId } });
    if (!m) throw new Error("Lapak tidak ditemukan.");
    if (m.owner_id === adminId) throw new Error("Tidak boleh membuat setoran untuk lapakmu sendiri — minta pengurus lain.");
    if (!m.owner_id) throw new Error("Lapak belum punya pemilik akun.");
    if (!m.rek_nomor) throw new Error("Lapak belum mengisi rekening setoran.");
    const vouchers = await tx.voucher.findMany({
      where: { merchant_id: merchantId, ...syaratSiapSetor() },
      select: { id: true, orderItem: { select: { unit_price: true, titipan: true } } },
    });
    if (!vouchers.length) throw new Error("Belum ada voucher yang siap disetor.");
    const kotor = vouchers.reduce((t, v) => t + hakLapak(v.orderItem), 0);
    const pot = await tx.potonganLapak.findMany({ where: { merchant_id: merchantId, setoran_id: null }, select: { id: true, nominal: true } });
    const potongan = pot.reduce((t, p) => t + p.nominal, 0);
    if (kotor <= potongan) throw new Error(`Potongan ${rp(potongan)} masih melebihi titipan siap setor ${rp(kotor)}.`);
    const setoran = await tx.setoranLapak.create({
      data: { merchant_id: merchantId, nominal_kotor: kotor, potongan, nominal: kotor - potongan, jumlah_voucher: vouchers.length, dibuat_oleh: adminId },
    });
    const v = await tx.voucher.updateMany({ where: { id: { in: vouchers.map((x) => x.id) }, setoran_id: null }, data: { setoran_id: setoran.id } });
    if (v.count !== vouchers.length) throw new Error("Data voucher berubah, ulangi.");
    if (pot.length) await tx.potonganLapak.updateMany({ where: { id: { in: pot.map((p) => p.id) } }, data: { setoran_id: setoran.id } });
    // Biaya transfer setoran ditanggung Kongsi (ditutup platform fee).
    const transferId = await antrikanTransfer(tx, {
      jenis: "setoran_lapak",
      userId: m.owner_id,
      merchantId,
      nominal: setoran.nominal,
      biaya: BIAYA_TRANSFER,
      ref: setoran.id,
      keterangan: `Setoran ${m.name}: ${vouchers.length} voucher ${rp(kotor)}${potongan ? ` − potongan ${rp(potongan)}` : ""}.`,
      tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
    });
    await tx.setoranLapak.update({ where: { id: setoran.id }, data: { transfer_id: transferId } });
    return setoran;
  });
}

// ============================================================
// Komplain & refund
// ============================================================

/** Pembeli melaporkan voucher: aktif (lapak menolak / cabang tutup) atau ditebus ≤ 3 hari tapi belum dilayani. */
export async function ajukanKomplain(userId: string, voucherId: string, alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 500);
  if (why.length < 10) throw new Error("Ceritakan masalahnya (minimal 10 huruf).");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucherId} FOR UPDATE`;
    const v = await tx.voucher.findUnique({ where: { id: voucherId }, include: { merchant: { select: { owner_id: true, name: true } } } });
    if (!v || v.user_id !== userId || !v.merchant_id || !v.order_item_id) throw new Error("Voucher tidak ditemukan.");
    if (v.komplain_status === "terbuka") throw new Error("Laporan untuk voucher ini sedang diperiksa.");
    if (v.komplain_status) throw new Error("Voucher ini sudah pernah dilaporkan.");
    if (v.setoran_id) throw new Error("Voucher ini sudah disetor ke lapak — hubungi Kongsi.");
    const bolehTerpakai = v.status === "terpakai" && v.redeemed_at && v.redeemed_at.getTime() > Date.now() - HARI_TAHAN_SETOR * HARI;
    if (v.status !== "aktif" && !bolehTerpakai) {
      throw new Error(`Laporan hanya untuk voucher aktif atau yang ditebus kurang dari ${HARI_TAHAN_SETOR} hari.`);
    }
    await tx.komplainVoucher.create({ data: { voucher_id: v.id, user_id: userId, alasan: why } });
    await tx.voucher.update({ where: { id: v.id }, data: { komplain_status: "terbuka" } });
    await beriKabar(tx, v.merchant?.owner_id, {
      kind: "voucher",
      title: `Laporan pembeli: ${v.title}`,
      body: `${why} — Kongsi memeriksa; titipan voucher ini ditahan sampai diputus.`,
      href: "/pakhuis/lapak",
    });
    await kabariPengurus(tx, { kind: "sistem", title: `Laporan voucher ${v.merchant?.name ?? ""}: ${v.title}`, body: why, href: "/admin/setoran" });
  });
}

/**
 * Kembalikan uang pembeli karena lapak gagal melayani. Pembeli kembali utuh; lapak dipotong platform fee + biaya DOKU
 * + biaya transfer; harga voucher tidak pernah disetor. Dipanggil dalam transaksi.
 */
async function kembalikanDalamTx(tx: Tx, voucherId: string, alasan: string) {
  await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucherId} FOR UPDATE`;
  const v = await tx.voucher.findUnique({
    where: { id: voucherId },
    include: { orderItem: { include: { order: { include: { items: { select: { qty: true } } } } } }, merchant: { select: { owner_id: true, name: true } } },
  });
  if (!v || !v.merchant_id || !v.orderItem) throw new Error("Voucher lapak tidak ditemukan.");
  if (v.setoran_id) throw new Error("Voucher sudah disetor ke lapak — tidak bisa dikembalikan otomatis.");
  if (v.status === "dikembalikan") throw new Error("Voucher sudah dikembalikan.");
  const o = v.orderItem.order;
  const jumlah = o.items.reduce((t, i) => t + i.qty, 0) || 1;
  const bagianFee = Math.round(o.bea / jumlah);
  const bagianDoku = Math.round(o.biaya_bayar / jumlah);
  // Yang benar-benar dibayar pembeli untuk voucher ini = harga − diskon lapak − diskon Kongsi per unit.
  const harga = v.orderItem.unit_price - v.orderItem.diskon_lapak_unit - v.orderItem.diskon_platform_unit;
  await tx.voucher.update({ where: { id: v.id }, data: { status: "dikembalikan", dikembalikan_at: new Date() } });
  await antrikanTransfer(tx, {
    jenis: "refund_belanja",
    userId: v.user_id,
    nominal: harga + bagianFee + bagianDoku,
    biaya: BIAYA_TRANSFER,
    ref: v.id,
    keterangan: `Pengembalian ${v.title} (${v.merchant?.name ?? "lapak"}): ${alasan}.`.slice(0, 300),
    tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
  });
  const potongan = bagianFee + bagianDoku + BIAYA_TRANSFER;
  await tx.potonganLapak.create({
    data: { merchant_id: v.merchant_id, voucher_id: v.id, nominal: potongan, alasan: `Pengembalian ${v.title}: ${alasan}`.slice(0, 300) },
  });
  await beriKabar(tx, v.merchant?.owner_id, {
    kind: "voucher",
    title: `Voucher dikembalikan ke pembeli: ${v.title}`,
    body: `${alasan}. Harga voucher tidak disetor; potongan biaya ${rp(potongan)} (platform fee, biaya pembayaran, transfer) dipotong dari setoran berikutnya.`,
    href: "/pakhuis/lapak",
  });
  return { nominal: harga + bagianFee + bagianDoku, potongan };
}

/** Pengurus memutus laporan: terima → uang pembeli kembali utuh (lapak dipotong); tolak → voucher kembali normal. */
export async function putusKomplain(adminId: string, komplainId: string, keputusan: "terima" | "tolak", alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 500);
  if (why.length < 10) throw new Error("Tulis alasan putusan (minimal 10 huruf).");
  if (keputusan !== "terima" && keputusan !== "tolak") throw new Error("Putusan tidak dikenal.");
  return prisma.$transaction(async (tx) => {
    const k = await tx.komplainVoucher.findUnique({ where: { id: komplainId } });
    if (!k || k.status !== "terbuka") throw new Error("Laporan sudah diputus.");
    const v = await tx.voucher.findUnique({ where: { id: k.voucher_id }, include: { merchant: { select: { owner_id: true } } } });
    if (!v) throw new Error("Voucher tidak ditemukan.");
    if (k.user_id === adminId || v.merchant?.owner_id === adminId) throw new Error("Tidak boleh memutus laporan yang melibatkan dirimu — minta pengurus lain.");
    const upd = await tx.komplainVoucher.updateMany({
      where: { id: k.id, status: "terbuka" },
      data: { status: keputusan === "terima" ? "diterima" : "ditolak", putus_oleh: adminId, putus_alasan: why, putus_at: new Date() },
    });
    if (upd.count !== 1) throw new Error("Laporan sudah diputus.");
    await tx.voucher.update({ where: { id: v.id }, data: { komplain_status: keputusan === "terima" ? "diterima" : "ditolak" } });
    if (keputusan === "terima") {
      const r = await kembalikanDalamTx(tx, v.id, `laporan pembeli terbukti — ${why}`);
      await beriKabar(tx, k.user_id, {
        kind: "voucher",
        title: `Laporanmu diterima: ${v.title}`,
        body: `${rp(r.nominal)} dikembalikan utuh ke rekeningmu paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja.`,
        href: "/pakhuis#transfer",
      });
    } else {
      await beriKabar(tx, k.user_id, { kind: "voucher", title: `Laporanmu tidak diterima: ${v.title}`, body: why, href: "/pakhuis#surat-jalan" });
      await beriKabar(tx, v.merchant?.owner_id, { kind: "voucher", title: `Laporan pembeli ditolak: ${v.title}`, body: why, href: "/pakhuis/lapak" });
    }
  });
}

/** Pengurus mengembalikan voucher tanpa laporan (cabang tutup permanen, lapak menolak voucher sah, lapak berhenti). */
export async function kembalikanVoucher(adminId: string, kode: string, alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 300);
  if (why.length < 10) throw new Error("Tulis alasan (minimal 10 huruf).");
  const code = String(kode ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  return prisma.$transaction(async (tx) => {
    const v = await tx.voucher.findUnique({ where: { code }, include: { merchant: { select: { owner_id: true } } } });
    if (!v || !v.merchant_id) throw new Error("Kode voucher lapak tidak dikenal.");
    if (v.user_id === adminId || v.merchant?.owner_id === adminId) throw new Error("Tidak boleh untuk voucher yang melibatkan dirimu.");
    if (v.status !== "aktif") throw new Error("Hanya voucher aktif yang bisa dikembalikan tanpa laporan.");
    const r = await kembalikanDalamTx(tx, v.id, why);
    await beriKabar(tx, v.user_id, {
      kind: "voucher",
      title: `Voucher dikembalikan: ${v.title}`,
      body: `${why}. ${rp(r.nominal)} dikembalikan utuh ke rekeningmu paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja.`,
      href: "/pakhuis#transfer",
    });
    return r;
  });
}

// ============================================================
// Pindah cabang
// ============================================================

/** Pembeli memindahkan voucher aktif ke cabang aktif lain di lapak yang sama (gratis). */
export async function pindahCabang(userId: string, voucherId: string, branchId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vouchers WHERE id = ${voucherId} FOR UPDATE`;
    const v = await tx.voucher.findUnique({ where: { id: voucherId } });
    if (!v || v.user_id !== userId || !v.merchant_id) throw new Error("Voucher tidak ditemukan.");
    if (v.status !== "aktif") throw new Error("Hanya voucher aktif yang bisa pindah cabang.");
    if (v.branch_id === branchId) throw new Error("Voucher sudah di cabang itu.");
    const b = await tx.merchantBranch.findFirst({ where: { id: branchId, merchant_id: v.merchant_id, is_active: true } });
    if (!b) throw new Error("Cabang tidak tersedia.");
    const m = await tx.merchant.findUnique({ where: { id: v.merchant_id }, select: { name: true, owner_id: true } });
    await tx.voucher.update({ where: { id: v.id }, data: { branch_id: b.id, note: `${m?.name ?? "Lapak"} · ${b.name}` } });
    await beriKabar(tx, userId, { kind: "voucher", title: `Voucher pindah ke ${b.name}`, body: v.title, href: "/pakhuis#surat-jalan" });
  });
}

/** Laporan terbuka (admin) + data voucher. */
export async function daftarKomplain() {
  const ks = await prisma.komplainVoucher.findMany({ where: { status: "terbuka" }, orderBy: { created_at: "asc" }, take: 100 });
  const vs = await prisma.voucher.findMany({
    where: { id: { in: ks.map((k) => k.voucher_id) } },
    select: {
      id: true,
      title: true,
      code: true,
      status: true,
      redeemed_at: true,
      merchant: { select: { name: true } },
      branch: { select: { name: true } },
      user: { select: { name: true, email: true } },
      orderItem: { select: { unit_price: true } },
    },
  });
  return ks.map((k) => ({ ...k, voucher: vs.find((v) => v.id === k.voucher_id) ?? null }));
}
