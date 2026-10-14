import "server-only";
import { prisma } from "@/lib/db";
import type { Tx } from "@/lib/domain/pundi";

// Diskon belanja e-voucher (Ch 8.44) — ala Shopee. Prinsip uang (arahan keras Tara): tidak ada kebocoran.
// - Diskon lapak ditanggung LAPAK (mengurangi titipan/hak lapak). Diskon Kongsi ditanggung KONGSI (dari platform fee),
//   wajib beranggaran → berhenti otomatis saat anggaran/kuota habis.
// - Maks 1 diskon lapak + 1 diskon Kongsi per pesanan; dipilih yang paling hemat; otomatis atau lewat klaim/kode.
// - Dialokasikan per unit voucher (dipakai setoran & refund). Tidak berlaku untuk lelang & Tukar Guling/Keteng.

export type DiskonItem = { product_id: string | null; merchant_id: string; unit_price: number; qty: number };
export type PerUnit = { diskonLapakUnit: number[]; diskonPlatformUnit: number[] };
export type HasilDiskon = {
  diskon_lapak: number;
  diskon_platform: number;
  perUnit: PerUnit[]; // sejajar dengan items
  dipakai: { id: string; pembuat: string; potongan: number }[];
  namaLapak: string | null;
  namaPlatform: string | null;
};

type DiskonRow = {
  id: string;
  pembuat: string;
  merchant_id: string | null;
  nama: string;
  kode: string | null;
  perlu_klaim: boolean;
  jenis: string;
  nilai: number;
  maks_potongan: number | null;
  produk_ids: string[];
  merchant_ids: string[];
  min_belanja: number;
  mulai_at: Date | null;
  selesai_at: Date | null;
  kuota_total: number | null;
  kuota_per_user: number;
  hanya_pembeli_baru: boolean;
  anggaran: number | null;
  terpakai_count: number;
  terpakai_rupiah: number;
};

/** Apakah diskon mencakup sebuah item (lapak & produk dalam cakupan). */
function mencakup(d: DiskonRow, it: DiskonItem): boolean {
  if (d.pembuat === "lapak") {
    if (it.merchant_id !== d.merchant_id) return false;
  } else if (d.merchant_ids.length && !d.merchant_ids.includes(it.merchant_id)) {
    return false;
  }
  if (d.produk_ids.length && (!it.product_id || !d.produk_ids.includes(it.product_id))) return false;
  return true;
}

/** Potongan diskon atas subtotal cakupannya (dibatasi maks & anggaran sisa). */
function potonganDiskon(d: DiskonRow, cakupanSubtotal: number): number {
  if (cakupanSubtotal <= 0) return 0;
  let p = d.jenis === "persen" ? Math.floor((cakupanSubtotal * d.nilai) / 100) : Math.min(d.nilai, cakupanSubtotal);
  if (d.maks_potongan != null) p = Math.min(p, d.maks_potongan);
  if (d.pembuat === "platform" && d.anggaran != null) p = Math.min(p, Math.max(0, d.anggaran - d.terpakai_rupiah));
  return Math.max(0, Math.min(p, cakupanSubtotal));
}

/**
 * Bagikan `total` potongan ke unit-unit yang tercakup, proporsional terhadap sisa harga tiap unit (bulat ke bawah,
 * sisa dibagikan ke unit termahal). Tidak pernah melebihi sisa harga unit → total diskon ≤ subtotal.
 */
function bagikan(
  items: DiskonItem[],
  d: DiskonRow,
  total: number,
  sisa: number[][], // sisa harga per unit [itemIndex][unit]
): number[][] {
  const alloc: number[][] = items.map((it) => Array(it.qty).fill(0));
  const unit: { i: number; u: number; sisa: number }[] = [];
  items.forEach((it, i) => {
    if (mencakup(d, it)) for (let u = 0; u < it.qty; u++) if (sisa[i][u] > 0) unit.push({ i, u, sisa: sisa[i][u] });
  });
  const dasar = unit.reduce((s, x) => s + x.sisa, 0);
  if (dasar <= 0 || total <= 0) return alloc;
  const bagi = Math.min(total, dasar);
  let terpakai = 0;
  for (const x of unit) {
    const p = Math.min(x.sisa, Math.floor((bagi * x.sisa) / dasar));
    alloc[x.i][x.u] = p;
    terpakai += p;
  }
  // Sisa pembulatan → unit dengan sisa harga terbesar.
  let lebih = bagi - terpakai;
  const urut = [...unit].sort((a, b) => b.sisa - a.sisa);
  for (const x of urut) {
    if (lebih <= 0) break;
    const ruang = sisa[x.i][x.u] - alloc[x.i][x.u];
    if (ruang > 0) {
      const tambah = Math.min(ruang, lebih);
      alloc[x.i][x.u] += tambah;
      lebih -= tambah;
    }
  }
  return alloc;
}

/** Baca kandidat diskon aktif yang relevan untuk item-item ini. */
async function kandidat(db: Tx | typeof prisma, userId: string, items: DiskonItem[], now: Date): Promise<DiskonRow[]> {
  const merchantIds = [...new Set(items.map((i) => i.merchant_id))];
  const rows = await db.diskon.findMany({
    where: {
      aktif: true,
      OR: [{ pembuat: "platform" }, { pembuat: "lapak", merchant_id: { in: merchantIds } }],
      AND: [{ OR: [{ mulai_at: null }, { mulai_at: { lte: now } }] }, { OR: [{ selesai_at: null }, { selesai_at: { gt: now } }] }],
    },
    select: {
      id: true, pembuat: true, merchant_id: true, nama: true, kode: true, perlu_klaim: true, jenis: true, nilai: true,
      maks_potongan: true, produk_ids: true, merchant_ids: true, min_belanja: true, mulai_at: true, selesai_at: true,
      kuota_total: true, kuota_per_user: true, hanya_pembeli_baru: true, anggaran: true, terpakai_count: true, terpakai_rupiah: true,
    },
  });
  return rows;
}

/** Diskon lolos syarat untuk user & keranjang ini? (periode sudah disaring di query) */
async function lolos(db: Tx | typeof prisma, d: DiskonRow, userId: string, items: DiskonItem[], kode: string | null): Promise<number> {
  if (d.kuota_total != null && d.terpakai_count >= d.kuota_total) return 0;
  if (d.pembuat === "platform" && d.anggaran != null && d.terpakai_rupiah >= d.anggaran) return 0;
  const cakupan = items.filter((it) => mencakup(d, it)).reduce((s, it) => s + it.unit_price * it.qty, 0);
  if (cakupan < d.min_belanja || cakupan <= 0) return 0;
  // Diskon berkode / perlu klaim: hanya bila kode cocok atau sudah diklaim.
  if (d.perlu_klaim || d.kode) {
    const cocokKode = d.kode && kode && d.kode.toUpperCase() === kode.toUpperCase();
    if (!cocokKode) {
      const klaim = await db.diskonKlaim.findUnique({ where: { diskon_id_user_id: { diskon_id: d.id, user_id: userId } } });
      if (!klaim) return 0;
    }
  }
  // Kuota per user (pemakaian yang dicadangkan/dipakai).
  const dipakaiUser = await db.pemakaianDiskon.count({ where: { diskon_id: d.id, user_id: userId, status: { in: ["dicadangkan", "dipakai"] } } });
  if (dipakaiUser >= d.kuota_per_user) return 0;
  // Hanya pembeli baru = belum pernah punya pesanan belanja lunas.
  if (d.hanya_pembeli_baru) {
    const pernah = await db.order.count({ where: { user_id: userId, status: "lunas", provider: { not: null } } });
    if (pernah > 0) return 0;
  }
  return potonganDiskon(d, cakupan);
}

/** Hitung diskon pesanan: pilih 1 lapak + 1 Kongsi terbaik, alokasikan per unit. `db` boleh tx (baris terkunci). */
export async function hitungDiskon(
  db: Tx | typeof prisma,
  userId: string,
  items: DiskonItem[],
  kode: string | null,
  now = new Date(),
): Promise<HasilDiskon> {
  const kosong: HasilDiskon = {
    diskon_lapak: 0, diskon_platform: 0,
    perUnit: items.map((it) => ({ diskonLapakUnit: Array(it.qty).fill(0), diskonPlatformUnit: Array(it.qty).fill(0) })),
    dipakai: [], namaLapak: null, namaPlatform: null,
  };
  if (!items.length) return kosong;
  const rows = await kandidat(db, userId, items, now);
  let bestLapak: { d: DiskonRow; p: number } | null = null;
  let bestPlatform: { d: DiskonRow; p: number } | null = null;
  for (const d of rows) {
    const p = await lolos(db, d, userId, items, kode);
    if (p <= 0) continue;
    if (d.pembuat === "lapak") { if (!bestLapak || p > bestLapak.p) bestLapak = { d, p }; }
    else if (!bestPlatform || p > bestPlatform.p) bestPlatform = { d, p };
  }
  if (!bestLapak && !bestPlatform) return kosong;

  // Sisa harga per unit; diskon lapak dulu, lalu Kongsi atas sisa.
  const sisa = items.map((it) => Array(it.qty).fill(it.unit_price));
  const perUnit: PerUnit[] = items.map((it) => ({ diskonLapakUnit: Array(it.qty).fill(0), diskonPlatformUnit: Array(it.qty).fill(0) }));
  const dipakai: HasilDiskon["dipakai"] = [];
  let diskonLapak = 0, diskonPlatform = 0;

  if (bestLapak) {
    const alloc = bagikan(items, bestLapak.d, bestLapak.p, sisa);
    alloc.forEach((arr, i) => arr.forEach((p, u) => { perUnit[i].diskonLapakUnit[u] = p; sisa[i][u] -= p; diskonLapak += p; }));
    if (diskonLapak > 0) dipakai.push({ id: bestLapak.d.id, pembuat: "lapak", potongan: diskonLapak });
  }
  if (bestPlatform) {
    // Hitung ulang potongan atas sisa (setelah diskon lapak) agar tidak melebihi.
    const cakupanSisa = items.reduce((s, it, i) => s + (mencakup(bestPlatform!.d, it) ? sisa[i].reduce((a, b) => a + b, 0) : 0), 0);
    const p = Math.min(bestPlatform.p, cakupanSisa);
    const alloc = bagikan(items, bestPlatform.d, p, sisa);
    alloc.forEach((arr, i) => arr.forEach((pp, u) => { perUnit[i].diskonPlatformUnit[u] = pp; diskonPlatform += pp; }));
    if (diskonPlatform > 0) dipakai.push({ id: bestPlatform.d.id, pembuat: "platform", potongan: diskonPlatform });
  }

  return {
    diskon_lapak: diskonLapak,
    diskon_platform: diskonPlatform,
    perUnit,
    dipakai,
    namaLapak: diskonLapak > 0 ? bestLapak!.d.nama : null,
    namaPlatform: diskonPlatform > 0 ? bestPlatform!.d.nama : null,
  };
}

/** Pratinjau (read-only) untuk keranjang/checkout. */
export function pratinjauDiskon(userId: string, items: DiskonItem[], kode: string | null) {
  return hitungDiskon(prisma, userId, items, kode);
}

/**
 * Kunci baris diskon kandidat (FOR UPDATE) lalu hitung — aman dari balapan kuota/anggaran. Dipakai dalam transaksi
 * pembuatan pesanan SEBELUM order dibuat; pencatatan pemakaian menyusul lewat `catatPemakaianDiskon`.
 */
export async function kunciHitungDiskon(tx: Tx, userId: string, items: DiskonItem[], kode: string | null): Promise<HasilDiskon> {
  if (!items.length) return hitungDiskon(tx, userId, items, kode);
  const now = new Date();
  const ids = (await kandidat(tx, userId, items, now)).map((d) => d.id);
  if (ids.length) await tx.$queryRawUnsafe(`SELECT id FROM diskon WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(",")}) FOR UPDATE`, ...ids);
  return hitungDiskon(tx, userId, items, kode, now);
}

/** Catat pemakaian diskon (dicadangkan) + naikkan counter. Baris diskon harus sudah dikunci di tx yang sama. */
export async function catatPemakaianDiskon(tx: Tx, orderId: string, userId: string, dipakai: HasilDiskon["dipakai"]) {
  for (const d of dipakai) {
    await tx.pemakaianDiskon.create({ data: { diskon_id: d.id, order_id: orderId, user_id: userId, potongan: d.potongan } });
    await tx.diskon.update({ where: { id: d.id }, data: { terpakai_count: { increment: 1 }, terpakai_rupiah: { increment: d.potongan } } });
  }
}

/** Pesanan lunas → pemakaian dipakai (tetap). */
export async function pakaiDiskon(tx: Tx, orderId: string) {
  await tx.pemakaianDiskon.updateMany({ where: { order_id: orderId, status: "dicadangkan" }, data: { status: "dipakai" } });
}

/** Pesanan gagal/kedaluwarsa → kembalikan kuota & anggaran. */
export async function lepasDiskon(tx: Tx, orderId: string) {
  const rows = await tx.pemakaianDiskon.findMany({ where: { order_id: orderId, status: "dicadangkan" } });
  for (const r of rows) {
    await tx.diskon.update({ where: { id: r.diskon_id }, data: { terpakai_count: { decrement: 1 }, terpakai_rupiah: { decrement: r.potongan } } });
  }
  await tx.pemakaianDiskon.updateMany({ where: { order_id: orderId, status: "dicadangkan" }, data: { status: "dilepas" } });
}

// ============================================================
// Kelola diskon (lapak & platform)
// ============================================================

export type DiskonInput = {
  nama: string;
  jenis: "persen" | "potongan";
  nilai: number;
  maks_potongan?: number | null;
  kode?: string | null;
  perlu_klaim?: boolean;
  produk_ids?: string[];
  merchant_ids?: string[]; // platform saja
  min_belanja?: number;
  mulai_at?: string | null;
  selesai_at?: string | null;
  kuota_total?: number | null;
  kuota_per_user?: number;
  hanya_pembeli_baru?: boolean;
  anggaran?: number | null; // platform
};

function rapikanDiskon(i: DiskonInput, pembuat: "platform" | "lapak") {
  const nama = String(i.nama ?? "").trim().slice(0, 80);
  if (nama.length < 3) throw new Error("Isi nama promo.");
  if (i.jenis !== "persen" && i.jenis !== "potongan") throw new Error("Pilih jenis diskon.");
  const nilai = Math.floor(Number(i.nilai) || 0);
  if (nilai <= 0) throw new Error("Isi nilai diskon.");
  if (i.jenis === "persen" && nilai > 100) throw new Error("Persen maksimal 100.");
  const kode = i.kode ? String(i.kode).toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 20) || null : null;
  const mulai = i.mulai_at ? new Date(i.mulai_at) : null;
  const selesai = i.selesai_at ? new Date(i.selesai_at) : null;
  if (mulai && selesai && selesai <= mulai) throw new Error("Periode selesai harus setelah mulai.");
  if (pembuat === "platform" && (i.anggaran == null || i.anggaran <= 0)) throw new Error("Promo Kongsi wajib punya anggaran.");
  return {
    pembuat,
    nama,
    jenis: i.jenis,
    nilai,
    maks_potongan: i.jenis === "persen" && i.maks_potongan ? Math.floor(i.maks_potongan) : null,
    kode,
    perlu_klaim: Boolean(i.perlu_klaim) || Boolean(kode),
    produk_ids: (i.produk_ids ?? []).map(String).slice(0, 100),
    merchant_ids: pembuat === "platform" ? (i.merchant_ids ?? []).map(String).slice(0, 100) : [],
    min_belanja: Math.max(0, Math.floor(i.min_belanja ?? 0)),
    mulai_at: mulai,
    selesai_at: selesai,
    kuota_total: i.kuota_total ? Math.max(1, Math.floor(i.kuota_total)) : null,
    // Default: tak dibatasi per orang (kecuali promo berkode/klaim atau pembeli baru yang alaminya sekali).
    kuota_per_user: Math.max(1, Math.floor(i.kuota_per_user || (i.kode || i.perlu_klaim || i.hanya_pembeli_baru ? 1 : 9999))),
    hanya_pembeli_baru: Boolean(i.hanya_pembeli_baru),
    anggaran: pembuat === "platform" ? Math.floor(i.anggaran!) : null,
  };
}

/** Lapak membuat diskon untuk produknya (ditanggung lapak). `merchantId` sudah diverifikasi pemiliknya. */
export async function buatDiskonLapak(userId: string, merchantId: string, input: DiskonInput) {
  const data = rapikanDiskon(input, "lapak");
  // Produk harus milik lapak itu.
  if (data.produk_ids.length) {
    const n = await prisma.merchantProduct.count({ where: { id: { in: data.produk_ids }, merchant_id: merchantId } });
    if (n !== data.produk_ids.length) throw new Error("Ada produk yang bukan milik lapak ini.");
  }
  return prisma.diskon.create({ data: { ...data, merchant_id: merchantId, dibuat_oleh: userId } });
}

/** Kongsi membuat diskon platform (ditanggung Kongsi, wajib anggaran). */
export async function buatDiskonPlatform(adminId: string, input: DiskonInput) {
  const data = rapikanDiskon(input, "platform");
  return prisma.diskon.create({ data: { ...data, dibuat_oleh: adminId } });
}

export async function aturDiskonAktif(diskonId: string, aktif: boolean, pemilikMerchantId?: string) {
  const d = await prisma.diskon.findUnique({ where: { id: diskonId }, select: { merchant_id: true, pembuat: true } });
  if (!d) throw new Error("Diskon tidak ditemukan.");
  if (pemilikMerchantId !== undefined && (d.pembuat !== "lapak" || d.merchant_id !== pemilikMerchantId)) throw new Error("Bukan diskon lapakmu.");
  await prisma.diskon.update({ where: { id: diskonId }, data: { aktif } });
}

function keRingkas(d: {
  id: string; nama: string; jenis: string; nilai: number; maks_potongan: number | null; kode: string | null; pembuat: string;
  min_belanja: number; mulai_at: Date | null; selesai_at: Date | null; kuota_total: number | null; terpakai_count: number;
  terpakai_rupiah: number; anggaran: number | null; aktif: boolean; hanya_pembeli_baru: boolean; perlu_klaim: boolean;
}) {
  return {
    id: d.id, nama: d.nama, jenis: d.jenis, nilai: d.nilai, maksPotongan: d.maks_potongan, kode: d.kode, pembuat: d.pembuat,
    minBelanja: d.min_belanja, mulai: d.mulai_at?.toISOString() ?? null, selesai: d.selesai_at?.toISOString() ?? null,
    kuotaTotal: d.kuota_total, terpakai: d.terpakai_count, terpakaiRupiah: d.terpakai_rupiah, anggaran: d.anggaran,
    aktif: d.aktif, hanyaPembeliBaru: d.hanya_pembeli_baru, perluKlaim: d.perlu_klaim,
  };
}

export async function daftarDiskonLapak(merchantId: string) {
  const rows = await prisma.diskon.findMany({ where: { pembuat: "lapak", merchant_id: merchantId }, orderBy: { created_at: "desc" }, take: 50 });
  return rows.map(keRingkas);
}

export async function daftarDiskonPlatform() {
  const rows = await prisma.diskon.findMany({ where: { pembuat: "platform" }, orderBy: { created_at: "desc" }, take: 100 });
  return rows.map(keRingkas);
}

/** Voucher diskon yang bisa diklaim pembeli di sebuah lapak (untuk halaman detail lapak). */
export async function voucherLapak(merchantId: string, userId: string | null) {
  const now = new Date();
  const rows = await prisma.diskon.findMany({
    where: {
      aktif: true, perlu_klaim: true,
      OR: [{ pembuat: "lapak", merchant_id: merchantId }, { pembuat: "platform", OR: [{ merchant_ids: { isEmpty: true } }, { merchant_ids: { has: merchantId } }] }],
      AND: [{ OR: [{ mulai_at: null }, { mulai_at: { lte: now } }] }, { OR: [{ selesai_at: null }, { selesai_at: { gt: now } }] }],
    },
    select: { id: true, nama: true, jenis: true, nilai: true, maks_potongan: true, kode: true, min_belanja: true, pembuat: true },
    take: 20,
  });
  const klaim = userId ? new Set((await prisma.diskonKlaim.findMany({ where: { user_id: userId, diskon_id: { in: rows.map((r) => r.id) } }, select: { diskon_id: true } })).map((k) => k.diskon_id)) : new Set<string>();
  return rows.map((r) => ({
    id: r.id, nama: r.nama, jenis: r.jenis, nilai: r.nilai, maksPotongan: r.maks_potongan, kode: r.kode, minBelanja: r.min_belanja,
    pembuat: r.pembuat, diklaim: klaim.has(r.id),
  }));
}

/** Pembeli mengklaim voucher diskon (berkode/perlu klaim). */
export async function klaimDiskon(userId: string, idAtauKode: string) {
  const key = String(idAtauKode ?? "").trim();
  if (!key) throw new Error("Masukkan kode voucher.");
  const d = await prisma.diskon.findFirst({
    where: { aktif: true, OR: [{ id: key }, { kode: { equals: key.toUpperCase(), mode: "insensitive" } }] },
    select: { id: true, nama: true, selesai_at: true },
  });
  if (!d) throw new Error("Voucher tidak ditemukan atau sudah tidak aktif.");
  if (d.selesai_at && d.selesai_at < new Date()) throw new Error("Voucher sudah berakhir.");
  await prisma.diskonKlaim.upsert({
    where: { diskon_id_user_id: { diskon_id: d.id, user_id: userId } },
    create: { diskon_id: d.id, user_id: userId },
    update: {},
  });
  return { nama: d.nama };
}
