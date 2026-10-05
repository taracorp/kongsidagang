import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { hold, captureHold, releaseHold, refundHold, type Tx } from "@/lib/domain/pundi";
import {
  beaTukar,
  validasiTambah,
  pastikanBoleh,
  TITIK_AMAN,
  JAM_COD,
  HARI_TAWARAN,
  MAKS_GAGAL_PINDAI,
  type Pihak,
} from "@/lib/domain/tukar-aturan";

// Alur Tukar Guling v2 (COD). Semua mutasi di dalam $transaction dengan baris deal dikunci,
// dan semua Keteng lewat helper rekber di pundi.ts.
//
// Ajukan  : A menahan bea_a (+ tambah Keteng bila A yang menambah).
// Terima  : B menahan bea_b (+ tambah bila B), kedua barang jadi dalam_tukar, tawaran lain ditolak.
// Pindai  : tiap pihak memindai kode pihak lain di Titik Aman; dua-duanya → selesai.
// Selesai : bea diambil platform, tambah Keteng dilepas ke pihak lain, barang jadi ditukar.
// Batal   : semua rekber kembali, barang kembali aktif.

const JAM = 3600_000;

type DealRow = NonNullable<Awaited<ReturnType<typeof bacaDeal>>>;

function bacaDeal(tx: Tx, id: string) {
  return tx.barterDeal.findUnique({
    where: { id },
    include: {
      itemA: { select: { id: true, user_id: true, title: true } },
      itemB: { select: { id: true, user_id: true, title: true } },
    },
  });
}

/** Kunci baris deal (FOR UPDATE) lalu baca isinya. */
async function kunciDeal(tx: Tx, id: string): Promise<DealRow> {
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

const lawan = (p: Pihak): Pihak => (p === "a" ? "b" : "a");
const pemilik = (d: DealRow, p: Pihak) => (p === "a" ? d.itemA.user_id : d.itemB.user_id);

// ============================================================
// Kode ketemu (QR + 6 digit) — diturunkan HMAC, tidak disimpan.
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
// Penyelesaian rekber
// ============================================================

async function selesaikan(tx: Tx, d: DealRow, status: "done" | "resolved", note?: string) {
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  for (const h of holds) {
    const p: Pihak = h.user_id === d.itemA.user_id ? "a" : "b";
    if (h.kind === "bea") await captureHold(tx, h.id, "bea_tukar", `Bea Tukar Guling: ${d.itemA.title} ⇄ ${d.itemB.title}`);
    else if (h.kind === "tambah") await releaseHold(tx, h.id, pemilik(d, lawan(p)), "Tambahan Keteng dari Tukar Guling");
    else await refundHold(tx, h.id, "Rekber Tukar Guling dikembalikan");
  }
  await tx.barterItem.updateMany({ where: { id: { in: [d.itemA.id, d.itemB.id] } }, data: { status: "ditukar" } });
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, closed_at: new Date(), ...(note ? { cancel_reason: note } : {}) },
  });
}

async function batalkan(
  tx: Tx,
  d: DealRow,
  status: "rejected" | "cancelled" | "expired" | "resolved",
  reason: string,
  fault: Pihak | null = null,
) {
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  for (const h of holds) await refundHold(tx, h.id, `Rekber Tukar Guling dikembalikan (${reason})`);
  // Barang dilepas hanya bila memang terkunci oleh deal ini (sudah sepakat).
  if (d.status === "agreed" || d.status === "disputed") {
    await tx.barterItem.updateMany({
      where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "dalam_tukar" },
      data: { status: "aktif" },
    });
  }
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, cancel_reason: reason, fault_party: fault, closed_at: new Date() },
  });
}

/** Tolak semua tawaran "proposed" lain yang melibatkan barang-barang ini (rekber dikembalikan). */
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

// ============================================================
// Aksi
// ============================================================

export async function ajukan(userId: string, myItemId: string, targetId: string, topup: number) {
  return prisma.$transaction(async (tx) => {
    const [mine, target] = await Promise.all([
      tx.barterItem.findUnique({ where: { id: myItemId } }),
      tx.barterItem.findUnique({ where: { id: targetId } }),
    ]);
    if (!mine || mine.user_id !== userId) throw new Error("Pilih barangmu sendiri.");
    if (mine.status !== "aktif") throw new Error("Barangmu sedang tidak tersedia.");
    if (!target || target.status !== "aktif") throw new Error("Barang tujuan tidak tersedia.");
    if (target.user_id === userId) throw new Error("Tidak bisa menukar dengan barang sendiri.");
    const dobel = await tx.barterDeal.findFirst({
      where: { item_a: myItemId, item_b: targetId, status: { in: ["proposed", "agreed", "disputed"] } },
      select: { id: true },
    });
    if (dobel) throw new Error("Kamu sudah mengajukan tukar untuk pasangan barang ini.");

    const va = mine.est_value;
    const vb = target.est_value;
    const from = validasiTambah(va, vb, topup);
    const fee_a = beaTukar(va);
    const fee_b = beaTukar(vb);

    const deal = await tx.barterDeal.create({
      data: {
        item_a: myItemId,
        item_b: targetId,
        proposer_id: userId,
        status: "proposed",
        mode: "cod",
        value_a: va,
        value_b: vb,
        topup_keping: from ? topup : 0,
        topup_from: from,
        fee_a,
        fee_b,
        expires_at: new Date(Date.now() + HARI_TAWARAN * 24 * JAM),
      },
    });
    const label = `${mine.title} ⇄ ${target.title}`;
    if (fee_a > 0) await hold(tx, userId, deal.id, fee_a, "bea", `Tahan bea Tukar: ${label}`);
    if (from === "a") await hold(tx, userId, deal.id, topup, "tambah", `Tahan tambahan Keteng: ${label}`);
    return deal.id;
  });
}

export async function terima(userId: string, dealId: string, meetType: string, meetPlace: string) {
  if (!TITIK_AMAN.some((t) => t.key === meetType)) throw new Error("Pilih jenis Titik Aman.");
  const place = meetPlace.trim();
  if (place.length < 3 || place.length > 80) throw new Error("Tulis nama tempat umum (3–80 huruf).");
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "terima");
    const kunci = await tx.barterItem.updateMany({
      where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "aktif" },
      data: { status: "dalam_tukar" },
    });
    if (kunci.count !== 2) throw new Error("Salah satu barang sudah tidak tersedia.");
    const label = `${d.itemA.title} ⇄ ${d.itemB.title}`;
    if (d.fee_b > 0) await hold(tx, userId, d.id, d.fee_b, "bea", `Tahan bea Tukar: ${label}`);
    if (d.topup_from === "b" && d.topup_keping > 0) {
      await hold(tx, userId, d.id, d.topup_keping, "tambah", `Tahan tambahan Keteng: ${label}`);
    }
    const now = new Date();
    await tx.barterDeal.update({
      where: { id: d.id },
      data: {
        status: "agreed",
        agreed_at: now,
        expires_at: new Date(now.getTime() + JAM_COD * JAM),
        meet_type: meetType,
        meet_place: place,
      },
    });
    await tolakTawaranLain(tx, [d.itemA.id, d.itemB.id], d.id, "Barang sudah disepakati dengan tawaran lain");
  });
}

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

export async function batalDiTempat(userId: string, dealId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "batal_di_tempat");
    const why = alasan.trim().slice(0, 200) || "tanpa alasan";
    await batalkan(tx, d, "cancelled", `Dibatalkan di tempat oleh pihak ${p.toUpperCase()}: ${why}`);
  });
}

export async function sengketa(userId: string, dealId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "sengketa");
    const why = alasan.trim().slice(0, 300);
    if (why.length < 5) throw new Error("Ceritakan masalahnya (minimal 5 huruf).");
    await tx.barterDeal.update({ where: { id: d.id }, data: { status: "disputed", cancel_reason: why } });
  });
}

/** Pihak `userId` memindai/mengetik kode milik pihak lawan. Dua-duanya terpindai → selesai. */
export async function pindai(userId: string, dealId: string, input: string): Promise<{ done: boolean }> {
  const res = await prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "pindai");
    if (!d.agreed_at) throw new Error("Tawaran belum disepakati.");
    if (d.scan_fails >= MAKS_GAGAL_PINDAI) {
      throw new Error("Terlalu banyak kode salah. Ajukan ke Syahbandar bila ada masalah.");
    }
    const target = lawan(p);
    const benar = kodeKetemu(d.id, target, d.agreed_at);
    if (!samaKode(ambilKode(input, d.id), benar)) {
      await tx.barterDeal.update({ where: { id: d.id }, data: { scan_fails: { increment: 1 } } });
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

/** Syahbandar memutus sengketa. */
export async function putus(dealId: string, keputusan: "selesai" | "batal") {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, "admin", "putus");
    if (keputusan === "selesai") await selesaikan(tx, d, "resolved", "Disahkan Syahbandar");
    else await batalkan(tx, d, "resolved", "Dibatalkan Syahbandar");
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

/** Dipanggil cron: tawaran/kesepakatan lewat batas waktu → kedaluwarsa, rekber kembali. */
export async function kedaluwarsakan(now = new Date()): Promise<number> {
  const due = await prisma.barterDeal.findMany({
    where: { status: { in: ["proposed", "agreed"] }, expires_at: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const { id } of due) {
    await prisma.$transaction(async (tx) => {
      const d = await kunciDeal(tx, id);
      if ((d.status !== "proposed" && d.status !== "agreed") || !d.expires_at || d.expires_at >= now) return;
      pastikanBoleh(d.status, "system", "kedaluwarsa");
      await batalkan(
        tx,
        d,
        "expired",
        d.status === "proposed" ? "Tawaran tidak dijawab 7 hari" : `Tidak ketemuan dalam ${JAM_COD} jam`,
      );
      n++;
    });
  }
  return n;
}
