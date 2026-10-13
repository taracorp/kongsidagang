import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { hold, captureHold, releaseHold, refundHold, credit, type Tx } from "@/lib/domain/pundi";
import { beriKabar, kabariKetua } from "@/lib/domain/kabar-user";
import { antrikanTransfer } from "@/lib/domain/transfer";
import { pastikanRekening } from "@/lib/domain/rekening";
import { kirimAktif } from "@/lib/shipping/kiriminaja";
import {
  beaTukar,
  depositKirim,
  estimasiCadangan,
  giliranSetor,
  jaminanKeteng,
  pembayarSelisih,
  penerimaSelisih,
  pastikanBoleh,
  tambahHariKerja,
  tenggatBayar,
  uangSetor,
  validasiTambah,
  BATAS_STRIKE,
  BIAYA_TRANSFER,
  HARI_BLOKIR,
  HARI_ESKALASI,
  HARI_KERJA_PENCAIRAN,
  HARI_STRIKE,
  JAM_BAYAR_ONGKIR,
  JAM_COD,
  JAM_PENAHANAN_SILANG,
  JAM_TAWARAN,
  MAKS_GAGAL_PINDAI,
  MAKS_TAWARAN_AKTIF,
  PENGINGAT_BAYAR_JAM,
  PENGINGAT_KONFIRMASI_JAM,
  STATUS_KUNCI,
  TITIK_AMAN,
  type DealUang,
  type ModeTukar,
  type Pihak,
} from "@/lib/domain/tukar-aturan";

// Alur Tukar Guling v3 (Ch 8.35). Semua mutasi di dalam $transaction dengan baris deal dikunci; Keteng lewat helper
// rekber di pundi.ts; uang keluar lewat transfer.ts.
//
// Ajukan   : gratis (tanpa tahanan). Maks 3 tawaran menunggu per pengaju, kedaluwarsa 72 jam.
// Terima   : B menahan jaminannya (bea [+ cadangan bila ia penerima selisih] [+ deposit + ongkir bila Kirim]),
//            kedua barang terkunci, status "menunggu_bayar" dengan tenggat 12 jam (tidak jatuh di jam tidur).
// Setor    : A menahan jaminannya + membayar selisih UANG lewat DOKU bila ia pembayar. Bila B pembayar selisih,
//            B membayar setelah A (penerima) menahan cadangan. Semua lunas → "agreed".
// COD      : saling pindai kode di Titik Aman → selesai. Kirim: tukar-kirim.ts.
// Selesai  : bea diambil platform, cadangan & deposit kembali, selisih diantrikan ke rekening penerima (≤ 2 hari kerja).
// Batal    : jaminan kembali, kecuali bea pihak bersalah (hangus). Selisih dikembalikan ke rekening pembayar; biaya
//            pengembaliannya ditanggung pihak bersalah (cadangan penerima, atau dipotong dari pengembalian pembayar).
//            Tanpa ganti rugi antar-user (aman dari akun kembar).

const JAM = 3600_000;
const HARI = 24 * JAM;

export type DealRow = NonNullable<Awaited<ReturnType<typeof bacaDeal>>>;

function bacaDeal(tx: Tx, id: string) {
  return tx.barterDeal.findUnique({
    where: { id },
    include: {
      itemA: { select: { id: true, user_id: true, title: true } },
      itemB: { select: { id: true, user_id: true, title: true } },
      shipments: true,
    },
  });
}

/** Kunci baris deal (FOR UPDATE) lalu baca isinya. */
export async function kunciDeal(tx: Tx, id: string): Promise<DealRow> {
  await tx.$queryRaw`SELECT id FROM barter_deals WHERE id = ${id} FOR UPDATE`;
  const d = await bacaDeal(tx, id);
  if (!d) throw new Error("Tawaran tidak ditemukan.");
  return d;
}

export function pihakDari(d: { itemA: { user_id: string }; itemB: { user_id: string } }, userId: string): Pihak {
  if (d.itemA.user_id === userId) return "a";
  if (d.itemB.user_id === userId) return "b";
  throw new Error("Bukan pihak dalam tawaran ini.");
}

export const lawan = (p: Pihak): Pihak => (p === "a" ? "b" : "a");
export const pemilik = (d: { itemA: { user_id: string }; itemB: { user_id: string } }, p: Pihak) =>
  p === "a" ? d.itemA.user_id : d.itemB.user_id;
const labelDeal = (d: { itemA: { title: string }; itemB: { title: string } }) => `${d.itemA.title} ⇄ ${d.itemB.title}`;
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const jamWib = (t: Date) =>
  t.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit" });

/** Kabar ke pihak deal (a, b, atau keduanya) dengan tautan ke halaman deal. */
export async function kabarDeal(tx: Tx, d: DealRow, siapa: Pihak | "keduanya", title: string, body?: string) {
  const ke = siapa === "keduanya" ? (["a", "b"] as Pihak[]) : [siapa];
  for (const p of ke) {
    await beriKabar(tx, pemilik(d, p), { kind: "tukar", title, body: body ?? labelDeal(d), href: `/tukar/deal/${d.id}` });
  }
}

/** Ringkasan uang deal untuk aturan murni (ongkir per pihak dari paket yang ia terima). */
export function dealUang(d: DealRow): DealUang {
  const ongkir = (uid: string) =>
    d.shipments.filter((s) => s.payer_id === uid).reduce((t, s) => t + s.shipping_cost + s.insurance, 0);
  return {
    topup_from: d.topup_from,
    selisih_uang: d.selisih_uang,
    biaya_transfer: d.biaya_transfer,
    cadangan: d.cadangan,
    fee_a: d.fee_a,
    fee_b: d.fee_b,
    deposit_a: d.deposit_a,
    deposit_b: d.deposit_b,
    ongkir_a: ongkir(d.itemA.user_id),
    ongkir_b: ongkir(d.itemB.user_id),
    setor_a_at: d.setor_a_at,
    setor_b_at: d.setor_b_at,
  };
}

// ============================================================
// Kode ketemu COD (QR + 6 digit) — diturunkan HMAC, tidak disimpan.
// ============================================================

function rahasia(): string {
  const s = process.env.BARTER_QR_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BARTER_QR_SECRET belum diatur.");
  return s;
}

export function kodeKetemu(dealId: string, pihak: Pihak, agreedAt: Date): string {
  const h = createHmac("sha256", rahasia()).update(`${dealId}:${pihak}:${agreedAt.getTime()}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

/** Terima "123456" atau isi QR "KDT:<dealId>:123456". */
function ambilKode(input: string, dealId: string): string {
  const s = input.trim();
  const m = s.match(/^KDT:([^:]+):(\d{6})$/);
  if (m) {
    if (m[1] !== dealId) throw new Error("QR ini untuk tawaran lain.");
    return m[2];
  }
  const digits = s.replace(/\D/g, "");
  if (digits.length !== 6) throw new Error("Kode harus 6 angka.");
  return digits;
}

function samaKode(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================
// Sanksi (strike) — tanpa ganti rugi antar-user
// ============================================================

export type JenisSanksi = "tidak_bayar" | "batal_sepihak" | "barang_tidak_sesuai" | "putusan_syahbandar";

const LABEL_SANKSI: Record<JenisSanksi, string> = {
  tidak_bayar: "tidak membayar sebelum batas waktu",
  batal_sepihak: "membatalkan sepihak",
  barang_tidak_sesuai: "barang tidak sesuai",
  putusan_syahbandar: "diputus bersalah oleh Syahbandar",
};

/** Sampai kapan user diblokir dari Tukar Guling (3 strike dalam 30 hari → 30 hari), atau null. */
export async function blokirSampai(db: Tx | typeof prisma, userId: string, now = new Date()): Promise<Date | null> {
  const rows = await db.sanksiTukar.findMany({
    where: { user_id: userId, created_at: { gt: new Date(now.getTime() - (HARI_STRIKE + HARI_BLOKIR) * HARI) } },
    orderBy: { created_at: "asc" },
    select: { created_at: true },
  });
  let sampai: Date | null = null;
  for (let i = BATAS_STRIKE - 1; i < rows.length; i++) {
    const awal = rows[i - BATAS_STRIKE + 1].created_at;
    const akhir = rows[i].created_at;
    if (akhir.getTime() - awal.getTime() <= HARI_STRIKE * HARI) {
      const s = new Date(akhir.getTime() + HARI_BLOKIR * HARI);
      if (!sampai || s > sampai) sampai = s;
    }
  }
  return sampai && sampai > now ? sampai : null;
}

/** Jumlah catatan pelanggaran dalam jendela strike (untuk Pakhuis). */
export function jumlahSanksi(db: Tx | typeof prisma, userId: string) {
  return db.sanksiTukar.count({ where: { user_id: userId, created_at: { gt: new Date(Date.now() - HARI_STRIKE * HARI) } } });
}

async function pastikanTidakDiblokir(db: Tx, userId: string) {
  const s = await blokirSampai(db, userId);
  if (s) {
    throw new Error(
      `Akunmu sedang tidak bisa ikut Tukar Guling sampai ${s.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long" })} (${BATAS_STRIKE} catatan pelanggaran dalam ${HARI_STRIKE} hari).`,
    );
  }
}

async function catatSanksi(tx: Tx, userId: string, dealId: string, jenis: JenisSanksi, keterangan?: string) {
  await tx.sanksiTukar.create({ data: { user_id: userId, deal_id: dealId, jenis, keterangan: keterangan?.slice(0, 300) ?? null } });
  const n = await tx.sanksiTukar.count({ where: { user_id: userId, created_at: { gt: new Date(Date.now() - HARI_STRIKE * HARI) } } });
  const blokir = await blokirSampai(tx, userId);
  await beriKabar(tx, userId, {
    kind: "tukar",
    title: `Catatan pelanggaran Tukar Guling (${Math.min(n, BATAS_STRIKE)}/${BATAS_STRIKE})`,
    body: blokir
      ? `Karena ${LABEL_SANKSI[jenis]}. Kamu tidak bisa ikut Tukar Guling ${HARI_BLOKIR} hari.`
      : `Karena ${LABEL_SANKSI[jenis]}. ${BATAS_STRIKE} catatan dalam ${HARI_STRIKE} hari = tidak bisa ikut Tukar Guling ${HARI_BLOKIR} hari.`,
    href: `/tukar/deal/${dealId}`,
  });
}

// ============================================================
// Penyelesaian
// ============================================================

/** Tolak semua tawaran "proposed" lain yang melibatkan barang-barang ini. */
async function tolakTawaranLain(tx: Tx, itemIds: string[], kecuali: string | null, reason: string) {
  const lain = await tx.barterDeal.findMany({
    where: {
      status: "proposed",
      id: kecuali ? { not: kecuali } : undefined,
      OR: [{ item_a: { in: itemIds } }, { item_b: { in: itemIds } }],
    },
    select: { id: true },
  });
  for (const { id } of lain) {
    const d = await kunciDeal(tx, id);
    if (d.status === "proposed") await batalkan(tx, d, "rejected", reason);
  }
}

export async function selesaikan(tx: Tx, d: DealRow, status: "done" | "resolved", note?: string) {
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  for (const h of holds) {
    const p: Pihak = h.user_id === d.itemA.user_id ? "a" : "b";
    if (h.kind === "bea") await captureHold(tx, h.id, "bea_tukar", `Bea Tukar Guling: ${labelDeal(d)}`);
    else if (h.kind === "tambah") await releaseHold(tx, h.id, pemilik(d, lawan(p)), "Tambahan Keteng dari Tukar Guling");
    // Paket sudah sampai → kurir sudah dibayar dari KA Credit; ongkir yang masih ditahan menutupnya.
    else if (h.kind === "ongkir") await captureHold(tx, h.id, "ongkir_tukar", `Ongkir Tukar Guling: ${labelDeal(d)}`);
    else await refundHold(tx, h.id, h.kind === "deposit" ? "Deposit Tukar Guling kembali" : "Jaminan Tukar Guling kembali");
  }

  // Selisih uang → rekening penerima, paling lambat 2 hari kerja (biaya transfer sudah dibayar pembayar selisih).
  const r = penerimaSelisih(d);
  let catatanSelisih = "";
  if (r && d.selisih_status === "ditahan") {
    const klaim = await tx.barterDeal.updateMany({ where: { id: d.id, selisih_status: "ditahan" }, data: { selisih_status: "dicairkan" } });
    if (klaim.count === 1) {
      await antrikanTransfer(tx, {
        jenis: "pencairan_selisih",
        userId: pemilik(d, r),
        nominal: d.selisih_uang,
        biaya: d.biaya_transfer,
        dealId: d.id,
        keterangan: `Selisih tukar ${labelDeal(d)}.`,
        tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
      });
      catatanSelisih = ` Selisih ${rp(d.selisih_uang)} ditransfer ke rekening penerima paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja.`;
    }
  }

  await tx.barterItem.updateMany({ where: { id: { in: [d.itemA.id, d.itemB.id] } }, data: { status: "ditukar" } });
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, closed_at: new Date(), ...(note ? { cancel_reason: note } : {}) },
  });
  await tolakTawaranLain(tx, [d.itemA.id, d.itemB.id], d.id, "Barang sudah ditukar");
  await kabarDeal(
    tx,
    d,
    "keduanya",
    status === "done" ? "Tukar selesai 🎉 Beri nilai lawan tukarmu" : "Sengketa diputus Syahbandar",
    `${note ?? labelDeal(d)}.${catatanSelisih}`,
  );
}

export type OpsiBatal = {
  /** Pihak penyebab batal: menanggung biaya pengembalian selisih & dapat catatan pelanggaran (bila `sanksi`). */
  fault?: Pihak | null;
  /** Bea pihak bersalah hangus (jadi pendapatan platform). */
  hanguskanBea?: boolean;
  sanksi?: JenisSanksi | null;
};

export async function batalkan(
  tx: Tx,
  d: DealRow,
  status: "rejected" | "cancelled" | "expired" | "resolved",
  reason: string,
  opsi: OpsiBatal = {},
) {
  const fault = opsi.fault ?? null;
  const r = penerimaSelisih(d);
  const p = pembayarSelisih(d);
  const selisihDitahan = d.selisih_status === "ditahan" && p !== null;
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  // Ongkir paket yang (mungkin) sudah dibuat di kurir TIDAK dikembalikan di sini: KA Credit platform sudah terpakai.
  // Paket ditandai "perlu_batal"; ongkir kembali hanya bila KiriminAja memastikan batal (rekonsiliasiPaket / webhook).
  const DI_KURIR = ["requested", "perlu_cek", "perlu_batal", "shipped", "delivered", "batal_gagal"];
  const ongkirDiKurir = new Set(d.shipments.filter((x) => x.order_id && DI_KURIR.includes(x.status)).map((x) => x.payer_id));
  const uidBersalah = fault ? pemilik(d, fault) : null;
  let beaHangus = 0;
  let kompensasiDoku = 0; // biaya DOKU pembayar yang diganti dari cadangan penerima (bila penerima bersalah)
  let cadanganDipakai = false;
  for (const h of holds) {
    if (h.kind === "ongkir" && ongkirDiKurir.has(h.user_id)) continue;
    if (h.kind === "bea" && opsi.hanguskanBea && h.user_id === uidBersalah) {
      await captureHold(tx, h.id, "bea_tukar_hangus", `Bea Tukar hangus (pihak penyebab batal): ${labelDeal(d)}`);
      beaHangus += h.amount;
      continue;
    }
    if (h.kind === "cadangan" && selisihDitahan && fault === r) {
      // Cadangan menutup biaya nyata pengembalian dana ke pembayar: biaya transfer + biaya DOKU yang ia keluarkan.
      await captureHold(tx, h.id, "cadangan_tukar", `Cadangan dipakai biaya pengembalian dana: ${labelDeal(d)}`);
      cadanganDipakai = true;
      kompensasiDoku = Math.max(0, Math.min(d.selisih_biaya_doku, h.amount - BIAYA_TRANSFER));
      const sisa = h.amount - BIAYA_TRANSFER - kompensasiDoku;
      if (sisa > 0) await credit(tx, h.user_id, sisa, "lepas", "Sisa cadangan Tukar Guling kembali");
      continue;
    }
    await refundHold(tx, h.id, `Jaminan Tukar Guling dikembalikan (${reason})`.slice(0, 200));
  }

  // Selisih uang → kembali ke rekening pembayar. Penerima bersalah → pembayar kembali utuh (selisih + biaya transfer
  // yang ia bayar + biaya DOKU-nya). Selain itu → biaya transfer pengembalian dipotong (biaya DOKU tidak kembali).
  let catatanSelisih = "";
  if (selisihDitahan) {
    const klaim = await tx.barterDeal.updateMany({ where: { id: d.id, selisih_status: "ditahan" }, data: { selisih_status: "dikembalikan" } });
    if (klaim.count === 1) {
      // "Utuh" hanya bila cadangan penerima benar-benar menutup biayanya — Kongsi tidak pernah menalangi.
      const utuh = fault === r && cadanganDipakai;
      const nominal = utuh ? d.selisih_uang + d.biaya_transfer + kompensasiDoku : d.selisih_uang + d.biaya_transfer - BIAYA_TRANSFER;
      await antrikanTransfer(tx, {
        jenis: "refund_selisih",
        userId: pemilik(d, p!),
        nominal,
        biaya: BIAYA_TRANSFER,
        dealId: d.id,
        keterangan: utuh
          ? `Pengembalian selisih tukar ${labelDeal(d)} (utuh — biaya ditanggung pihak penyebab batal).`
          : `Pengembalian selisih tukar ${labelDeal(d)} (dipotong biaya transfer ${rp(BIAYA_TRANSFER)}).`,
        tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
      });
      catatanSelisih = ` Selisih ${rp(nominal)} dikembalikan ke rekening pembayar paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja.`;
    }
  }

  // Barang dilepas hanya bila memang terkunci oleh deal ini.
  if ((STATUS_KUNCI as string[]).includes(d.status)) {
    await tx.barterItem.updateMany({
      where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "dalam_tukar" },
      data: { status: "aktif" },
    });
  }
  await tx.barterShipment.updateMany({
    where: { deal_id: d.id, status: { in: ["quoted", "paid", "failed"] } },
    data: { status: "canceled", status_text: reason.slice(0, 300) },
  });
  // Order kurir yang belum dijemput → minta dibatalkan (diproses rekonsiliasiPaket di luar transaksi).
  await tx.barterShipment.updateMany({
    where: { deal_id: d.id, status: { in: ["requested", "perlu_cek"] }, order_id: { not: null } },
    data: { status: "perlu_batal", status_text: `Meminta pembatalan ke kurir (${reason})`.slice(0, 300) },
  });
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, cancel_reason: reason.slice(0, 500), fault_party: fault, closed_at: new Date() },
  });
  if (fault && opsi.sanksi) await catatSanksi(tx, uidBersalah!, d.id, opsi.sanksi, reason);

  const judul =
    status === "rejected" ? "Tawaran tukar ditolak" : status === "expired" ? "Tawaran tukar kedaluwarsa" : status === "resolved" ? "Sengketa diputus Syahbandar" : "Tukar dibatalkan";
  const jaminan = holds.length ? " Jaminan Keteng sudah kembali" + (beaHangus ? `, kecuali bea ${rp(beaHangus)} milik pihak penyebab batal (hangus).` : ".") : "";
  await kabarDeal(tx, d, "keduanya", judul, `${reason}.${jaminan}${catatanSelisih}`);
}

async function pastikanAlamat(tx: Tx, userId: string, addressId: string | null | undefined) {
  if (!addressId) throw new Error("Pilih alamat pengiriman.");
  const a = await tx.userAddress.findFirst({ where: { id: addressId, user_id: userId }, select: { id: true } });
  if (!a) throw new Error("Alamat tidak ditemukan.");
  return a.id;
}

/** Ada tagihan setor (DOKU) yang masih berjalan untuk deal ini? Selama ada, deal tidak dibatalkan/kedaluwarsa. */
export async function adaSetorBerjalan(db: Tx | typeof prisma, dealId: string, now = new Date()): Promise<boolean> {
  const o = await db.topupOrder.findFirst({
    where: {
      tujuan: "tukar_setor",
      status: "pending",
      muatan: { path: ["dealId"], equals: dealId },
      // beri 15 menit setelah kedaluwarsa untuk notifikasi DOKU yang terlambat
      expires_at: { gt: new Date(now.getTime() - 15 * 60_000) },
    },
    select: { id: true },
  });
  return Boolean(o);
}

// ============================================================
// Ajukan (gratis)
// ============================================================

export type AjukanOpsi = { mode?: ModeTukar; addressId?: string | null };

export async function ajukan(userId: string, myItemId: string, targetId: string, topup: number, opsi: AjukanOpsi = {}) {
  return prisma.$transaction(async (tx) => {
    const mode: ModeTukar = opsi.mode === "kirim" ? "kirim" : "cod";
    await pastikanTidakDiblokir(tx, userId);
    const aktif = await tx.barterDeal.count({ where: { proposer_id: userId, status: "proposed" } });
    if (aktif >= MAKS_TAWARAN_AKTIF) {
      throw new Error(`Maksimal ${MAKS_TAWARAN_AKTIF} tawaran menunggu jawaban. Tarik salah satu atau tunggu jawabannya.`);
    }
    // Berurutan: satu koneksi transaksi tidak boleh menjalankan query paralel.
    const mine = await tx.barterItem.findUnique({ where: { id: myItemId } });
    const target = await tx.barterItem.findUnique({ where: { id: targetId } });
    if (!mine || mine.user_id !== userId) throw new Error("Pilih barangmu sendiri.");
    if (mine.status !== "aktif") throw new Error("Barangmu sedang tidak tersedia.");
    if (!target || target.status !== "aktif") throw new Error("Barang tujuan tidak tersedia.");
    if (target.user_id === userId) throw new Error("Tidak bisa menukar dengan barang sendiri.");
    if (mode === "kirim" && !kirimAktif()) throw new Error("Mode Kirim belum tersedia. Pilih COD.");
    if (mode === "kirim" && (!mine.category || !target.category)) throw new Error("Barang tanpa kategori taksiran hanya bisa COD.");
    const dobel = await tx.barterDeal.findFirst({
      where: { item_a: myItemId, item_b: targetId, status: { in: ["proposed", ...STATUS_KUNCI] } },
      select: { id: true },
    });
    if (dobel) throw new Error("Kamu sudah mengajukan tukar untuk pasangan barang ini.");
    const addressId = mode === "kirim" ? await pastikanAlamat(tx, userId, opsi.addressId) : null;

    const va = mine.est_value;
    const vb = target.est_value;
    const from = validasiTambah(va, vb, topup);
    // Selisih uang: pembayar perlu rekening untuk pengembalian, penerima untuk pencairan.
    if (from) await pastikanRekening(tx, userId, from === "a" ? "untuk pengembalian bila batal" : "untuk menerima selisih");

    const deal = await tx.barterDeal.create({
      data: {
        versi: 3,
        item_a: myItemId,
        item_b: targetId,
        proposer_id: userId,
        status: "proposed",
        mode,
        value_a: va,
        value_b: vb,
        topup_keping: 0,
        topup_from: from,
        selisih_uang: from ? topup : 0,
        biaya_transfer: from ? BIAYA_TRANSFER : 0,
        fee_a: beaTukar(va),
        fee_b: beaTukar(vb),
        address_a_id: addressId,
        expires_at: new Date(Date.now() + JAM_TAWARAN * JAM),
      },
    });
    const uang = from ? ` · selisih ${rp(topup)} dibayar ${from === "a" ? "pengaju" : "kamu"}` : "";
    await beriKabar(tx, target.user_id, {
      kind: "tukar",
      title: "Tawaran tukar masuk",
      body: `${mine.title} ditawarkan untuk ${target.title}${mode === "kirim" ? " (kirim kurir)" : " (COD)"}${uang}`,
      href: `/tukar/deal/${deal.id}`,
    });
    return deal.id;
  });
}

// ============================================================
// Terima → menunggu pembayaran
// ============================================================

export type TerimaOpsi = { meetType?: string; meetPlace?: string; addressId?: string | null };
export type OngkirKutipan = { a_to_b: number; b_to_a: number };

async function cekTerima(tx: Tx, d: DealRow, userId: string, opsi: TerimaOpsi) {
  pastikanBoleh(d.status, pihakDari(d, userId), "terima");
  if (d.versi < 3) throw new Error("Tawaran ini memakai aturan lama — minta pengaju mengajukan ulang.");
  let meet: { meet_type: string; meet_place: string } | null = null;
  let addressB: string | null = null;
  if (d.mode === "cod") {
    if (!TITIK_AMAN.some((t) => t.key === opsi.meetType)) throw new Error("Pilih jenis Titik Aman.");
    const place = (opsi.meetPlace ?? "").trim();
    if (place.length < 3 || place.length > 80) throw new Error("Tulis nama tempat umum (3–80 huruf).");
    meet = { meet_type: opsi.meetType!, meet_place: place };
  } else {
    addressB = await pastikanAlamat(tx, userId, opsi.addressId);
  }
  return { meet, addressB };
}

/** Jaminan & deposit setelah ongkir diketahui (deposit tidak kurang dari ongkir paket yang dikirim pihak itu). */
function hitungJaminan(d: DealRow, ongkir: OngkirKutipan | null): DealUang {
  const kirim = d.mode === "kirim";
  const base: DealUang = {
    ...dealUang(d),
    deposit_a: kirim ? depositKirim(d.value_a ?? 0, ongkir?.a_to_b ?? 0) : 0,
    deposit_b: kirim ? depositKirim(d.value_b ?? 0, ongkir?.b_to_a ?? 0) : 0,
    ongkir_a: kirim ? (ongkir?.b_to_a ?? 0) : 0, // A menerima paket B→A
    ongkir_b: kirim ? (ongkir?.a_to_b ?? 0) : 0,
    cadangan: 0,
  };
  const p = pembayarSelisih(base);
  return { ...base, cadangan: p ? estimasiCadangan(base.selisih_uang, jaminanKeteng(base, p)) : 0 };
}

/** Rincian jaminan B saat menerima (untuk tampilan & Bayar Langsung). */
export async function hitungTerima(userId: string, dealId: string, opsi: TerimaOpsi, ongkir: OngkirKutipan | null = null) {
  return prisma.$transaction(async (tx) => {
    const d = await bacaDeal(tx, dealId);
    if (!d) throw new Error("Tawaran tidak ditemukan.");
    await cekTerima(tx, d, userId, opsi);
    return jaminanKeteng(hitungJaminan(d, ongkir), "b");
  });
}

/** Perkiraan jaminan & cadangan tanpa memvalidasi input (tampilan halaman deal; ongkir Kirim belum diketahui). */
export function perkiraanJaminan(d: DealRow) {
  const j = hitungJaminan(d, null);
  return { keteng_a: jaminanKeteng(j, "a"), keteng_b: jaminanKeteng(j, "b"), cadangan: j.cadangan };
}

/**
 * B menerima. COD: wajib Titik Aman. Kirim: wajib alamat; `kirimSiap.buatPaket` (dalam transaksi yang sama) membuat
 * dua paket "quoted" sesuai kutipan ongkir. B langsung menahan jaminannya; A diberi tenggat untuk menyetor.
 */
export async function terima(
  userId: string,
  dealId: string,
  opsi: TerimaOpsi,
  kirimSiap?: { ongkir: OngkirKutipan; buatPaket: (tx: Tx, d: DealRow, addressB: string) => Promise<void> },
) {
  return prisma.$transaction(
    async (tx) => {
      const d = await kunciDeal(tx, dealId);
      const { meet, addressB } = await cekTerima(tx, d, userId, opsi);
      await pastikanTidakDiblokir(tx, userId);
      const r = penerimaSelisih(d);
      if (r) await pastikanRekening(tx, userId, r === "b" ? "untuk menerima selisih" : "untuk pengembalian bila batal");

      const kunci = await tx.barterItem.updateMany({
        where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "aktif" },
        data: { status: "dalam_tukar" },
      });
      if (kunci.count !== 2) throw new Error("Salah satu barang sudah tidak tersedia.");

      if (d.mode === "kirim") {
        if (!kirimSiap) throw new Error("Mode Kirim belum tersedia.");
        await kirimSiap.buatPaket(tx, d, addressB!);
      }
      const j = hitungJaminan(d, d.mode === "kirim" ? kirimSiap!.ongkir : null);
      const now = new Date();
      const tenggat = tenggatBayar(now);
      const bPembayar = pembayarSelisih(d) === "b";
      await tx.barterDeal.update({
        where: { id: d.id },
        data: {
          status: "menunggu_bayar",
          expires_at: tenggat,
          deposit_a: j.deposit_a,
          deposit_b: j.deposit_b,
          cadangan: j.cadangan,
          setor_b_at: bPembayar ? null : now, // B pembayar selisih → bayar setelah A menyetor
          ...(meet ?? {}),
          ...(addressB ? { address_b_id: addressB } : {}),
        },
      });
      const segar = await kunciDeal(tx, d.id);
      await tahanJaminan(tx, segar, "b");

      await kabarDeal(
        tx,
        segar,
        "a",
        "Tawaranmu diterima 🤝 Selesaikan pembayaran",
        `${labelDeal(d)} — batas ${jamWib(tenggat)} WIB. Lewat batas = batal & dicatat sebagai pelanggaran.`,
      );
      return { tenggat };
    },
    { timeout: 30_000 },
  );
}

/** Tahan jaminan Keteng pihak p (bea, deposit, ongkir paket yang ia terima, cadangan bila ia penerima selisih). */
async function tahanJaminan(tx: Tx, d: DealRow, p: Pihak) {
  const uid = pemilik(d, p);
  const label = labelDeal(d);
  const fee = p === "a" ? d.fee_a : d.fee_b;
  const deposit = p === "a" ? d.deposit_a : d.deposit_b;
  if (fee > 0) await hold(tx, uid, d.id, fee, "bea", `Tahan bea Tukar: ${label}`);
  if (deposit > 0) await hold(tx, uid, d.id, deposit, "deposit", `Tahan deposit Kirim: ${label}`);
  if (penerimaSelisih(d) === p && d.cadangan > 0) {
    await hold(tx, uid, d.id, d.cadangan, "cadangan", `Tahan cadangan biaya pengembalian dana: ${label}`);
  }
  for (const s of d.shipments.filter((x) => x.payer_id === uid && x.status === "quoted")) {
    const amt = s.shipping_cost + s.insurance;
    if (amt > 0) await hold(tx, uid, d.id, amt, "ongkir", `Tahan ongkir Tukar: ${label}`);
    await tx.barterShipment.update({ where: { id: s.id }, data: { status: "paid" } });
  }
}

// ============================================================
// Setor (jaminan + selisih uang)
// ============================================================

export type Setoran = { pihak: Pihak; keteng: number; uang: number; tenggat: Date | null };

function hitungSetoranRow(d: DealRow, userId: string): Setoran {
  const p = pihakDari(d, userId);
  pastikanBoleh(d.status, p, "setor", d.mode);
  const g = giliranSetor(d);
  if (g !== p) throw new Error(g ? "Menunggu pihak lain menyetor dulu." : "Semua pembayaran sudah lunas.");
  const u = dealUang(d);
  // B sudah menahan jaminan Keteng saat menerima; giliran B hanya membayar selisih uang.
  return { pihak: p, keteng: p === "a" ? jaminanKeteng(u, "a") : 0, uang: uangSetor(u, p), tenggat: d.expires_at };
}

/** Yang harus disetor user sekarang (untuk tampilan & Bayar Langsung). */
export async function hitungSetor(userId: string, dealId: string): Promise<Setoran> {
  const d = await prisma.$transaction((tx) => bacaDeal(tx, dealId));
  if (!d) throw new Error("Tawaran tidak ditemukan.");
  return hitungSetoranRow(d, userId);
}

/** Tandai setor pihak p selesai; bila semua lunas → agreed. Return true bila mode Kirim siap dibuat order kurir. */
async function setorSelesai(tx: Tx, d: DealRow, p: Pihak): Promise<boolean> {
  const now = new Date();
  const lain = p === "a" ? d.setor_b_at : d.setor_a_at;
  if (lain) {
    const kirim = d.mode === "kirim";
    await tx.barterDeal.update({
      where: { id: d.id },
      data: {
        ...(p === "a" ? { setor_a_at: now } : { setor_b_at: now }),
        status: "agreed",
        agreed_at: now,
        expires_at: new Date(now.getTime() + (kirim ? JAM_BAYAR_ONGKIR : JAM_COD) * JAM),
      },
    });
    await kabarDeal(
      tx,
      d,
      "keduanya",
      "Tukar disepakati — semua pembayaran lunas ✓",
      kirim ? "Order kurir sedang dibuat. Siapkan & kemas barangmu." : `Ketemuan di ${d.meet_place} dalam ${JAM_COD} jam. Kontak lawan sudah terbuka.`,
    );
    return kirim;
  }
  // A (penerima selisih) sudah menahan cadangan → giliran B membayar selisih, tenggat baru.
  const tenggat = tenggatBayar(now);
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { ...(p === "a" ? { setor_a_at: now } : { setor_b_at: now }), expires_at: tenggat, pengingat_bayar_at: null },
  });
  await kabarDeal(tx, d, lawan(p), "Giliranmu membayar selisih tukar", `${labelDeal(d)} — batas ${jamWib(tenggat)} WIB.`);
  return false;
}

/** Setor jaminan Keteng dari saldo (tanpa selisih uang). Selisih uang wajib lewat DOKU (setorLunas). */
export async function setor(userId: string, dealId: string): Promise<{ siapKirim: boolean }> {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const s = hitungSetoranRow(d, userId);
    if (s.uang > 0) throw new Error("Selisih tukar dibayar lewat QRIS / Virtual Account.");
    if (s.pihak === "a") await tahanJaminan(tx, d, "a");
    return { siapKirim: await setorSelesai(tx, d, s.pihak) };
  });
}

/**
 * Pembayaran DOKU untuk setor sudah lunas (dipanggil jalankanTujuan). Keteng bagian tagihan sudah masuk Pundi;
 * `rekber` = uang selisih + biaya transfer yang ditahan Kongsi. Gagal → pemanggil mengembalikan uangnya.
 */
export async function setorLunas(
  userId: string,
  dealId: string,
  bayar: { invoice: string; rekber: number; biayaRekber: number },
): Promise<{ siapKirim: boolean }> {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const s = hitungSetoranRow(d, userId);
    if (s.uang !== bayar.rekber) throw new Error("Nominal selisih berubah — pembayaran dikembalikan.");
    if (s.pihak === "a") await tahanJaminan(tx, d, "a");
    if (s.uang > 0) {
      await tx.barterDeal.update({
        where: { id: d.id },
        data: { selisih_status: "ditahan", selisih_invoice: bayar.invoice, selisih_biaya_doku: Math.max(0, bayar.biayaRekber) },
      });
    }
    return { siapKirim: await setorSelesai(tx, d, s.pihak) };
  });
}

// ============================================================
// Batal & tolak
// ============================================================

export async function tolak(userId: string, dealId: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "tolak");
    await batalkan(tx, d, "rejected", "Ditolak penerima");
  });
}

export async function tarik(userId: string, dealId: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "tarik");
    await batalkan(tx, d, "cancelled", "Ditarik pengaju");
  });
}

/** Mundur saat menunggu pembayaran: pihak yang mundur = penyebab batal (bea-nya hangus + catatan pelanggaran). */
export async function batalMenunggu(userId: string, dealId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "batal_menunggu", d.mode);
    if (await adaSetorBerjalan(tx, d.id)) throw new Error("Ada pembayaran yang sedang diproses — tunggu sampai selesai atau kedaluwarsa.");
    const why = alasan.trim().slice(0, 200) || "tanpa alasan";
    await batalkan(tx, d, "cancelled", `Dibatalkan pihak ${p.toUpperCase()} sebelum pembayaran lengkap: ${why}`, {
      fault: p,
      hanguskanBea: true,
      sanksi: "batal_sepihak",
    });
  });
}

/**
 * COD: batal saat/sebelum ketemu. Kirim: batal sebelum paket dibuat.
 * `tidakSesuai` (COD): barang lawan tidak sesuai → semua kembali, lawan = penyebab (catatan pelanggaran).
 * Selain itu pembatal = penyebab: bea-nya hangus + catatan pelanggaran.
 */
export async function batalDiTempat(userId: string, dealId: string, alasan: string, tidakSesuai = false) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, d.mode === "kirim" ? "batal_sebelum_kirim" : "batal_di_tempat", d.mode);
    if (d.shipments.some((s) => s.order_id && s.status !== "failed")) {
      throw new Error("Paket sudah dibuat di kurir — ajukan ke Syahbandar bila ada masalah.");
    }
    // Anti-tipu: begitu satu kode dipindai (satu pihak sudah menyerahkan barang & kode), tukar tidak bisa dibatalkan
    // sepihak — kalau bisa, penipu membawa barang lalu membatalkan dan semua uang kembali kepadanya.
    if (d.scanned_a_at || d.scanned_b_at) {
      throw new Error("Salah satu kode sudah dipindai — tukar tidak bisa dibatalkan sepihak. Ajukan ke Syahbandar bila ada masalah.");
    }
    const why = alasan.trim().slice(0, 200) || "tanpa alasan";
    if (tidakSesuai && d.mode === "cod") {
      const pemilikBarang = lawan(p);
      await batalkan(tx, d, "cancelled", `Barang pihak ${pemilikBarang.toUpperCase()} tidak sesuai (dilaporkan pihak ${p.toUpperCase()}): ${why}`, {
        fault: pemilikBarang,
        hanguskanBea: false,
        sanksi: "barang_tidak_sesuai",
      });
      return;
    }
    const kapan = d.mode === "kirim" ? "sebelum dikirim" : "di tempat";
    await batalkan(tx, d, "cancelled", `Dibatalkan ${kapan} oleh pihak ${p.toUpperCase()}: ${why}`, {
      fault: p,
      hanguskanBea: true,
      sanksi: "batal_sepihak",
    });
  });
}

// ============================================================
// Sengketa & Syahbandar
// ============================================================

/** Pihak mengajukan ke Syahbandar: wajib alasan + foto bukti. */
export async function sengketa(userId: string, dealId: string, alasan: string, buktiUrl: string | null) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "sengketa", d.mode);
    const why = alasan.trim().slice(0, 500);
    if (why.length < 10) throw new Error("Ceritakan masalahnya (minimal 10 huruf).");
    if (!buktiUrl) throw new Error("Lampirkan foto bukti (barang, tempat ketemu, atau tangkapan layar).");
    await tx.barterDeal.update({
      where: { id: d.id },
      data: { status: "disputed", cancel_reason: `Pihak ${p.toUpperCase()}: ${why}`, bukti_url: buktiUrl, sengketa_at: new Date() },
    });
    await kabarDeal(tx, d, "keduanya", "Tukar diajukan ke Syahbandar", why);
  });
}

/** Sistem mengirim deal ke Syahbandar (paket bermasalah / penahanan silang / pindaian setengah). */
export async function sengketaSistem(tx: Tx, d: DealRow, alasan: string, fault: Pihak | null = null) {
  pastikanBoleh(d.status, "system", "sengketa", d.mode);
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status: "disputed", cancel_reason: alasan, fault_party: fault, sengketa_at: new Date() },
  });
  await kabarDeal(tx, d, "keduanya", "Tukar diteruskan ke Syahbandar", alasan);
}

/**
 * Syahbandar memutus: "sah" (tukar jadi) atau "batal". `bersalah` = pihak penyebab (bea-nya hangus bila batal,
 * menanggung biaya pengembalian selisih, dan dapat catatan pelanggaran). Alasan wajib & tercatat.
 */
export async function putus(adminId: string, dealId: string, keputusan: "sah" | "batal", bersalah: Pihak | null, alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 500);
  if (why.length < 10) throw new Error("Tulis alasan putusan (minimal 10 huruf).");
  if (keputusan !== "sah" && keputusan !== "batal") throw new Error("Putusan tidak dikenal.");
  if (bersalah !== null && bersalah !== "a" && bersalah !== "b") throw new Error("Pihak bersalah tidak dikenal.");
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, "admin", "putus");
    if (pemilik(d, "a") === adminId || pemilik(d, "b") === adminId) {
      throw new Error("Tidak boleh memutus sengketa tukarmu sendiri — minta pengurus lain.");
    }
    await tx.barterDeal.update({ where: { id: d.id }, data: { putus_oleh: adminId, putus_alasan: why, putus_at: new Date() } });
    if (keputusan === "sah") {
      await selesaikan(tx, d, "resolved", `Disahkan Syahbandar: ${why}`);
      if (bersalah) await catatSanksi(tx, pemilik(d, bersalah), d.id, "putusan_syahbandar", why);
    } else {
      await batalkan(tx, d, "resolved", `Dibatalkan Syahbandar: ${why}`, {
        fault: bersalah,
        hanguskanBea: bersalah !== null,
        sanksi: bersalah ? "putusan_syahbandar" : null,
      });
    }
  });
}

// ============================================================
// COD & Kirim
// ============================================================

/** COD: pihak `userId` memindai/mengetik kode milik pihak lawan. Dua-duanya terpindai → selesai. */
export async function pindai(userId: string, dealId: string, input: string): Promise<{ done: boolean }> {
  const res = await prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "pindai", d.mode);
    if (!d.agreed_at) throw new Error("Tawaran belum disepakati.");
    // Batas salah kode dihitung per orang: satu pihak tidak bisa mengunci pindaian pihak lain.
    const gagalKu = p === "a" ? d.scan_fails_a : d.scan_fails_b;
    if (gagalKu >= MAKS_GAGAL_PINDAI) {
      throw new Error("Terlalu banyak kode salah. Ajukan ke Syahbandar bila ada masalah.");
    }
    const target = lawan(p);
    const benar = kodeKetemu(d.id, target, d.agreed_at);
    if (!samaKode(ambilKode(input, d.id), benar)) {
      await tx.barterDeal.update({
        where: { id: d.id },
        data: p === "a" ? { scan_fails: { increment: 1 }, scan_fails_a: { increment: 1 } } : { scan_fails: { increment: 1 }, scan_fails_b: { increment: 1 } },
      });
      return { ok: false as const };
    }
    const now = new Date();
    const scanned = {
      a: target === "a" ? now : d.scanned_a_at,
      b: target === "b" ? now : d.scanned_b_at,
    };
    await tx.barterDeal.update({
      where: { id: d.id },
      data: target === "a" ? { scanned_a_at: scanned.a } : { scanned_b_at: scanned.b },
    });
    if (scanned.a && scanned.b) {
      await selesaikan(tx, d, "done");
      return { ok: true as const, done: true };
    }
    return { ok: true as const, done: false };
  });
  // Error dilempar setelah commit agar hitungan gagal tetap tersimpan.
  if (!res.ok) throw new Error("Kode tidak cocok. Minta pihak lain menunjukkan kodenya lagi.");
  return { done: res.done };
}

/** Kirim: pihak menyatakan barang lawan sudah diterima & sesuai. Dua-duanya (atau otomatis) → selesai. */
export async function konfirmasi(aktor: { userId: string } | "system", dealId: string): Promise<{ done: boolean }> {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    if (aktor === "system") {
      pastikanBoleh(d.status, "system", "konfirmasi", d.mode);
      await selesaikan(tx, d, "done", "Dikonfirmasi otomatis setelah paket sampai");
      return { done: true };
    }
    const p = pihakDari(d, aktor.userId);
    pastikanBoleh(d.status, p, "konfirmasi", d.mode);
    const now = new Date();
    const conf = { a: p === "a" ? now : d.confirmed_a_at, b: p === "b" ? now : d.confirmed_b_at };
    await tx.barterDeal.update({
      where: { id: d.id },
      data: p === "a" ? { confirmed_a_at: now } : { confirmed_b_at: now },
    });
    if (conf.a && conf.b) {
      await selesaikan(tx, d, "done");
      return { done: true };
    }
    return { done: false };
  });
}

/** Tutup barang sendiri; tawaran yang masih menunggu ikut ditolak. */
export async function tutupBarang(userId: string, itemId: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.barterItem.updateMany({
      where: { id: itemId, user_id: userId, status: "aktif" },
      data: { status: "ditutup" },
    });
    if (res.count === 0) throw new Error("Barang tidak bisa ditutup (sedang dalam tukar atau tidak ada).");
    await tolakTawaranLain(tx, [itemId], null, "Barang ditutup pemiliknya");
  });
}

// ============================================================
// Cron
// ============================================================

/**
 * Dipanggil cron:
 * - tawaran tak dijawab 72 jam / pembayaran tak lunas sebelum tenggat (→ catatan pelanggaran pihak yang belum bayar) /
 *   kesepakatan lewat batas → kedaluwarsa (kecuali paket di kurir / pindaian setengah → Syahbandar);
 * - paket sampai lewat JAM_KONFIRMASI → selesai otomatis;
 * - pengingat bayar (2 jam sebelum tenggat) & konfirmasi (24 & 6 jam sebelum otomatis);
 * - penahanan silang → Syahbandar; sengketa > 7 hari → kabar ke Ketua.
 */
export async function majukanTukar(now = new Date()) {
  const hasil = { kedaluwarsa: 0, selesai: 0, sengketa: 0, pengingat: 0 };

  const due = await prisma.barterDeal.findMany({
    where: { status: { in: ["proposed", "menunggu_bayar", "agreed", "diterima"] }, expires_at: { lt: now } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of due) {
    const r = await prisma.$transaction(async (tx) => {
      const d = await kunciDeal(tx, id);
      if (!d.expires_at || d.expires_at >= now) return null;
      if (d.status === "diterima") {
        await selesaikan(tx, d, "done", "Dikonfirmasi otomatis setelah paket sampai");
        return "selesai" as const;
      }
      if (d.status === "menunggu_bayar") {
        if (await adaSetorBerjalan(tx, d.id, now)) return null; // tunggu hasil pembayaran yang sedang berjalan
        const telat = giliranSetor(d);
        await batalkan(tx, d, "expired", `Pembayaran pihak ${(telat ?? "?").toUpperCase()} tidak lunas sebelum batas waktu`, {
          fault: telat,
          hanguskanBea: false,
          sanksi: telat ? "tidak_bayar" : null,
        });
        return "kedaluwarsa" as const;
      }
      if (d.status !== "proposed" && d.status !== "agreed") return null;
      if (d.shipments.some((s) => s.order_id && s.status !== "failed")) {
        await sengketaSistem(tx, d, "Batas waktu lewat tetapi sebagian paket sudah dibuat di kurir");
        return "sengketa" as const;
      }
      // COD lewat batas dengan salah satu kode sudah dipindai → bukan dikembalikan otomatis (bisa menguntungkan
      // penipu yang sudah membawa barang), tetapi diputus Syahbandar.
      if (d.status === "agreed" && d.mode === "cod" && (d.scanned_a_at || d.scanned_b_at)) {
        await sengketaSistem(tx, d, `Batas ${JAM_COD} jam lewat setelah salah satu kode dipindai — perlu diputus Syahbandar`);
        return "sengketa" as const;
      }
      if (d.status === "proposed") {
        await batalkan(tx, d, "expired", `Tawaran tidak dijawab ${JAM_TAWARAN} jam`);
        return "kedaluwarsa" as const;
      }
      if (d.versi < 3 && d.mode === "kirim") {
        // Alur lama: pihak yang belum melunasi ongkir dicatat sebagai penyebab.
        const belumBayar = d.shipments.filter((s) => s.status === "quoted").map((s) => (s.payer_id === d.itemA.user_id ? "a" : "b"));
        await batalkan(tx, d, "expired", `Ongkir tidak dilunasi dalam ${JAM_BAYAR_ONGKIR} jam`, {
          fault: belumBayar.length === 1 ? (belumBayar[0] as Pihak) : null,
        });
        return "kedaluwarsa" as const;
      }
      // Lewat batas tanpa bukti siapa yang salah → semua kembali (biaya pengembalian selisih ke pembayar).
      await batalkan(
        tx,
        d,
        "expired",
        d.mode === "cod" ? `Tidak ketemuan dalam ${JAM_COD} jam` : `Order kurir tidak bisa dibuat dalam ${JAM_BAYAR_ONGKIR} jam`,
      );
      return "kedaluwarsa" as const;
    });
    if (r) hasil[r]++;
  }

  // Pengingat bayar: 2 jam sebelum tenggat, ke pihak yang gilirannya.
  const tagih = await prisma.barterDeal.findMany({
    where: { status: "menunggu_bayar", pengingat_bayar_at: null, expires_at: { gt: now, lt: new Date(now.getTime() + PENGINGAT_BAYAR_JAM * JAM) } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of tagih) {
    const kirim = await prisma.$transaction(async (tx) => {
      const d = await kunciDeal(tx, id);
      const g = giliranSetor(d);
      if (d.status !== "menunggu_bayar" || d.pengingat_bayar_at || !g || !d.expires_at) return false;
      await tx.barterDeal.update({ where: { id }, data: { pengingat_bayar_at: now } });
      await kabarDeal(tx, d, g, "⏰ 2 jam lagi batas pembayaran tukar", `${labelDeal(d)} — batas ${jamWib(d.expires_at)} WIB.`);
      return true;
    });
    if (kirim) hasil.pengingat++;
  }

  // Pengingat konfirmasi Kirim: 24 jam & 6 jam sebelum konfirmasi otomatis.
  const [j1, j2] = PENGINGAT_KONFIRMASI_JAM;
  const konf = await prisma.barterDeal.findMany({
    where: { status: "diterima", pengingat_konfirmasi: { lt: 2 }, expires_at: { gt: now, lt: new Date(now.getTime() + j1 * JAM) } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of konf) {
    const kirim = await prisma.$transaction(async (tx) => {
      const d = await kunciDeal(tx, id);
      if (d.status !== "diterima" || !d.expires_at) return false;
      const sisaJam = (d.expires_at.getTime() - now.getTime()) / JAM;
      const tahap = sisaJam <= j2 ? 2 : 1;
      if (d.pengingat_konfirmasi >= tahap) return false;
      await tx.barterDeal.update({ where: { id }, data: { pengingat_konfirmasi: tahap } });
      const belum = (["a", "b"] as Pihak[]).filter((p) => !(p === "a" ? d.confirmed_a_at : d.confirmed_b_at));
      for (const p of belum) {
        await kabarDeal(
          tx,
          d,
          p,
          `Konfirmasi otomatis ${Math.ceil(sisaJam)} jam lagi`,
          "Periksa barang yang kamu terima. Ada masalah? Ajukan ke Syahbandar sebelum konfirmasi otomatis.",
        );
      }
      return true;
    });
    if (kirim) hasil.pengingat++;
  }

  const batasSilang = new Date(now.getTime() - JAM_PENAHANAN_SILANG * JAM);
  const silang = await prisma.barterDeal.findMany({
    where: { status: "dikirim", shipments: { some: { shipped_at: { lt: batasSilang } } } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of silang) {
    const r = await prisma.$transaction(async (tx) => {
      const d = await kunciDeal(tx, id);
      if (d.status !== "dikirim") return null;
      const jalan = d.shipments.find((s) => s.shipped_at && s.shipped_at < batasSilang);
      const mandek = d.shipments.find((s) => !s.shipped_at);
      if (!jalan || !mandek) return null;
      const fault: Pihak = mandek.leg === "a_to_b" ? "a" : "b";
      await sengketaSistem(
        tx,
        d,
        `Penahanan silang: pihak ${fault.toUpperCase()} belum menyerahkan paket ke kurir ${JAM_PENAHANAN_SILANG} jam setelah pihak lain mengirim`,
        fault,
      );
      return "sengketa" as const;
    });
    if (r) hasil[r]++;
  }

  // Sengketa yang belum diputus > 7 hari → Ketua.
  const lama = await prisma.barterDeal.findMany({
    where: { status: "disputed", eskalasi_at: null, sengketa_at: { lt: new Date(now.getTime() - HARI_ESKALASI * HARI) } },
    select: { id: true, itemA: { select: { title: true } }, itemB: { select: { title: true } } },
    take: 50,
  });
  for (const d of lama) {
    await prisma.$transaction(async (tx) => {
      const n = await tx.barterDeal.updateMany({ where: { id: d.id, eskalasi_at: null }, data: { eskalasi_at: now } });
      if (n.count === 1) {
        await kabariKetua(tx, {
          kind: "sistem",
          title: `Sengketa tukar > ${HARI_ESKALASI} hari belum diputus`,
          body: labelDeal(d),
          href: "/admin/tukar",
        });
      }
    });
  }
  return hasil;
}
