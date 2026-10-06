import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { hold, captureHold, releaseHold, refundHold, type Tx } from "@/lib/domain/pundi";
import { beriKabar } from "@/lib/domain/kabar-user";
import {
  beaTukar,
  depositKirim,
  validasiTambah,
  pastikanBoleh,
  TITIK_AMAN,
  JAM_COD,
  JAM_BAYAR_ONGKIR,
  JAM_PENAHANAN_SILANG,
  HARI_TAWARAN,
  MAKS_GAGAL_PINDAI,
  type Pihak,
  type ModeTukar,
} from "@/lib/domain/tukar-aturan";

// Alur Tukar Guling v2. Semua mutasi di dalam $transaction dengan baris deal dikunci,
// dan semua Keteng lewat helper rekber di pundi.ts.
//
// Ajukan  : A menahan bea_a (+ tambah Keteng bila A yang menambah, + deposit bila mode Kirim).
// Terima  : B menahan bea_b (+ tambah, + deposit), kedua barang jadi dalam_tukar, tawaran lain ditolak.
// COD     : tiap pihak memindai kode pihak lain di Titik Aman; dua-duanya → selesai.
// Kirim   : lihat tukar-kirim.ts (ongkir, order KiriminAja, webhook, konfirmasi).
// Selesai : bea diambil platform, tambah Keteng dilepas ke pihak lain, deposit kembali, barang jadi ditukar.
// Batal   : semua rekber yang masih ditahan kembali, barang kembali aktif.

const JAM = 3600_000;

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
export const pemilik = (d: DealRow, p: Pihak) => (p === "a" ? d.itemA.user_id : d.itemB.user_id);
const labelDeal = (d: { itemA: { title: string }; itemB: { title: string } }) => `${d.itemA.title} ⇄ ${d.itemB.title}`;

/** Kabar ke pihak deal (a, b, atau keduanya) dengan tautan ke halaman deal. */
export async function kabarDeal(tx: Tx, d: DealRow, siapa: Pihak | "keduanya", title: string, body?: string) {
  const ke = siapa === "keduanya" ? (["a", "b"] as Pihak[]) : [siapa];
  for (const p of ke) {
    await beriKabar(tx, pemilik(d, p), { kind: "tukar", title, body: body ?? labelDeal(d), href: `/tukar/deal/${d.id}` });
  }
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
// Penyelesaian rekber
// ============================================================

export async function selesaikan(tx: Tx, d: DealRow, status: "done" | "resolved", note?: string) {
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  for (const h of holds) {
    const p: Pihak = h.user_id === d.itemA.user_id ? "a" : "b";
    if (h.kind === "bea") await captureHold(tx, h.id, "bea_tukar", `Bea Tukar Guling: ${labelDeal(d)}`);
    else if (h.kind === "tambah") await releaseHold(tx, h.id, pemilik(d, lawan(p)), "Tambahan Keteng dari Tukar Guling");
    else await refundHold(tx, h.id, h.kind === "deposit" ? "Deposit Tukar Guling kembali" : "Rekber Tukar Guling dikembalikan");
  }
  await tx.barterItem.updateMany({ where: { id: { in: [d.itemA.id, d.itemB.id] } }, data: { status: "ditukar" } });
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, closed_at: new Date(), ...(note ? { cancel_reason: note } : {}) },
  });
  await kabarDeal(tx, d, "keduanya", status === "done" ? "Tukar selesai 🎉 Beri nilai lawan tukarmu" : "Sengketa diputus Syahbandar", note ?? labelDeal(d));
}

export async function batalkan(
  tx: Tx,
  d: DealRow,
  status: "rejected" | "cancelled" | "expired" | "resolved",
  reason: string,
  fault: Pihak | null = null,
) {
  const holds = await tx.walletHold.findMany({ where: { deal_id: d.id, status: "ditahan" } });
  for (const h of holds) await refundHold(tx, h.id, `Rekber Tukar Guling dikembalikan (${reason})`);
  // Barang dilepas hanya bila memang terkunci oleh deal ini.
  if (["agreed", "dikirim", "diterima", "disputed"].includes(d.status)) {
    await tx.barterItem.updateMany({
      where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "dalam_tukar" },
      data: { status: "aktif" },
    });
  }
  await tx.barterShipment.updateMany({
    where: { deal_id: d.id, status: { in: ["quoted", "paid"] } },
    data: { status: "canceled", status_text: reason },
  });
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status, cancel_reason: reason, fault_party: fault, closed_at: new Date() },
  });
  const judul =
    status === "rejected" ? "Tawaran tukar ditolak" : status === "expired" ? "Tawaran tukar kedaluwarsa" : status === "resolved" ? "Sengketa diputus Syahbandar" : "Tukar dibatalkan";
  await kabarDeal(tx, d, "keduanya", judul, `${reason} · Keteng yang ditahan sudah kembali.`);
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

async function pastikanAlamat(tx: Tx, userId: string, addressId: string | null | undefined) {
  if (!addressId) throw new Error("Pilih alamat pengiriman.");
  const a = await tx.userAddress.findFirst({ where: { id: addressId, user_id: userId }, select: { id: true } });
  if (!a) throw new Error("Alamat tidak ditemukan.");
  return a.id;
}

// ============================================================
// Aksi
// ============================================================

export type AjukanOpsi = { mode?: ModeTukar; addressId?: string | null };

/** Validasi + hitungan tawaran (tanpa menulis). Dipakai `ajukan` dan Bayar Langsung. */
async function siapkanAjukan(tx: Tx, userId: string, myItemId: string, targetId: string, topup: number, opsi: AjukanOpsi) {
  const mode: ModeTukar = opsi.mode === "kirim" ? "kirim" : "cod";
  // Berurutan: satu koneksi transaksi tidak boleh menjalankan query paralel.
  const mine = await tx.barterItem.findUnique({ where: { id: myItemId } });
  const target = await tx.barterItem.findUnique({ where: { id: targetId } });
  if (!mine || mine.user_id !== userId) throw new Error("Pilih barangmu sendiri.");
  if (mine.status !== "aktif") throw new Error("Barangmu sedang tidak tersedia.");
  if (!target || target.status !== "aktif") throw new Error("Barang tujuan tidak tersedia.");
  if (target.user_id === userId) throw new Error("Tidak bisa menukar dengan barang sendiri.");
  if (mode === "kirim" && (!mine.category || !target.category)) {
    throw new Error("Barang tanpa kategori taksiran hanya bisa COD.");
  }
  const dobel = await tx.barterDeal.findFirst({
    where: {
      item_a: myItemId,
      item_b: targetId,
      status: { in: ["proposed", "agreed", "dikirim", "diterima", "disputed"] },
    },
    select: { id: true },
  });
  if (dobel) throw new Error("Kamu sudah mengajukan tukar untuk pasangan barang ini.");
  const addressId = mode === "kirim" ? await pastikanAlamat(tx, userId, opsi.addressId) : null;

  const va = mine.est_value;
  const vb = target.est_value;
  const from = validasiTambah(va, vb, topup);
  const fee_a = beaTukar(va);
  const fee_b = beaTukar(vb);
  const deposit_a = mode === "kirim" ? depositKirim(va) : 0;
  const deposit_b = mode === "kirim" ? depositKirim(vb) : 0;
  const ditahan = fee_a + (from === "a" ? topup : 0) + deposit_a;
  return { mode, mine, target, addressId, va, vb, from, fee_a, fee_b, deposit_a, deposit_b, ditahan };
}

/** Keteng yang akan ditahan dari pengaju (untuk Bayar Langsung). */
export function hitungAjukan(userId: string, myItemId: string, targetId: string, topup: number, opsi: AjukanOpsi = {}) {
  return prisma.$transaction((tx) => siapkanAjukan(tx, userId, myItemId, targetId, topup, opsi).then((r) => r.ditahan));
}

export async function ajukan(userId: string, myItemId: string, targetId: string, topup: number, opsi: AjukanOpsi = {}) {
  return prisma.$transaction(async (tx) => {
    const { mode, mine, target, addressId, va, vb, from, fee_a, fee_b, deposit_a, deposit_b } = await siapkanAjukan(
      tx,
      userId,
      myItemId,
      targetId,
      topup,
      opsi,
    );

    const deal = await tx.barterDeal.create({
      data: {
        item_a: myItemId,
        item_b: targetId,
        proposer_id: userId,
        status: "proposed",
        mode,
        value_a: va,
        value_b: vb,
        topup_keping: from ? topup : 0,
        topup_from: from,
        fee_a,
        fee_b,
        deposit_a,
        deposit_b,
        address_a_id: addressId,
        expires_at: new Date(Date.now() + HARI_TAWARAN * 24 * JAM),
      },
    });
    const label = `${mine.title} ⇄ ${target.title}`;
    if (fee_a > 0) await hold(tx, userId, deal.id, fee_a, "bea", `Tahan bea Tukar: ${label}`);
    if (from === "a") await hold(tx, userId, deal.id, topup, "tambah", `Tahan tambahan Keteng: ${label}`);
    if (deposit_a > 0) await hold(tx, userId, deal.id, deposit_a, "deposit", `Tahan deposit Kirim: ${label}`);
    await beriKabar(tx, target.user_id, {
      kind: "tukar",
      title: "Tawaran tukar masuk",
      body: `${mine.title} ditawarkan untuk ${target.title}${mode === "kirim" ? " (kirim kurir)" : " (COD)"}`,
      href: `/tukar/deal/${deal.id}`,
    });
    return deal.id;
  });
}

export type TerimaOpsi = { meetType?: string; meetPlace?: string; addressId?: string | null };

async function cekTerima(tx: Tx, d: DealRow, userId: string, opsi: TerimaOpsi) {
  pastikanBoleh(d.status, pihakDari(d, userId), "terima");
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

/** Keteng yang ditahan dari penerima saat menerima (tanpa ongkir; ongkir dihitung di tukar-kirim). */
export function hitungTerima(userId: string, dealId: string, opsi: TerimaOpsi) {
  return prisma.$transaction(async (tx) => {
    const d = await bacaDeal(tx, dealId);
    if (!d) throw new Error("Tawaran tidak ditemukan.");
    await cekTerima(tx, d, userId, opsi);
    return d.fee_b + (d.topup_from === "b" ? d.topup_keping : 0) + d.deposit_b;
  });
}

/**
 * B menerima. COD: wajib Titik Aman. Kirim: wajib alamat; `siapkanKirim` (dalam transaksi yang sama)
 * membuat dua paket berstatus quoted dan menahan ongkir milik B.
 */
export async function terima(
  userId: string,
  dealId: string,
  opsi: TerimaOpsi,
  siapkanKirim?: (tx: Tx, d: DealRow, addressB: string) => Promise<void>,
) {
  return prisma.$transaction(
    async (tx) => {
      const d = await kunciDeal(tx, dealId);
      const { meet, addressB } = await cekTerima(tx, d, userId, opsi);

      const kunci = await tx.barterItem.updateMany({
        where: { id: { in: [d.itemA.id, d.itemB.id] }, status: "aktif" },
        data: { status: "dalam_tukar" },
      });
      if (kunci.count !== 2) throw new Error("Salah satu barang sudah tidak tersedia.");
      const label = labelDeal(d);
      if (d.fee_b > 0) await hold(tx, userId, d.id, d.fee_b, "bea", `Tahan bea Tukar: ${label}`);
      if (d.topup_from === "b" && d.topup_keping > 0) {
        await hold(tx, userId, d.id, d.topup_keping, "tambah", `Tahan tambahan Keteng: ${label}`);
      }
      if (d.deposit_b > 0) await hold(tx, userId, d.id, d.deposit_b, "deposit", `Tahan deposit Kirim: ${label}`);

      const now = new Date();
      await tx.barterDeal.update({
        where: { id: d.id },
        data: {
          status: "agreed",
          agreed_at: now,
          expires_at: new Date(now.getTime() + (d.mode === "cod" ? JAM_COD : JAM_BAYAR_ONGKIR) * JAM),
          ...(meet ?? {}),
          ...(addressB ? { address_b_id: addressB } : {}),
        },
      });
      if (d.mode === "kirim") {
        if (!siapkanKirim) throw new Error("Mode Kirim belum tersedia.");
        await siapkanKirim(tx, { ...d, address_b_id: addressB }, addressB!);
      }
      await tolakTawaranLain(tx, [d.itemA.id, d.itemB.id], d.id, "Barang sudah disepakati dengan tawaran lain");
      await kabarDeal(
        tx,
        d,
        "a",
        "Tawaranmu diterima 🤝",
        d.mode === "kirim" ? `Lunasi ongkir dalam ${JAM_BAYAR_ONGKIR} jam agar paket dijemput kurir.` : `Ketemuan di ${meet?.meet_place} dalam ${JAM_COD} jam.`,
      );
    },
    { timeout: 20_000 },
  );
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

/** COD: batal saat/sebelum ketemu. Kirim: batal sebelum paket dibuat. Semua rekber kembali. */
export async function batalDiTempat(userId: string, dealId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, d.mode === "kirim" ? "batal_sebelum_kirim" : "batal_di_tempat", d.mode);
    if (d.shipments.some((s) => s.order_id && s.status !== "failed")) {
      throw new Error("Paket sudah dibuat di kurir — ajukan ke Syahbandar bila ada masalah.");
    }
    const why = alasan.trim().slice(0, 200) || "tanpa alasan";
    const kapan = d.mode === "kirim" ? "sebelum dikirim" : "di tempat";
    await batalkan(tx, d, "cancelled", `Dibatalkan ${kapan} oleh pihak ${p.toUpperCase()}: ${why}`);
  });
}

export async function sengketa(userId: string, dealId: string, alasan: string) {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "sengketa", d.mode);
    const why = alasan.trim().slice(0, 300);
    if (why.length < 5) throw new Error("Ceritakan masalahnya (minimal 5 huruf).");
    await tx.barterDeal.update({ where: { id: d.id }, data: { status: "disputed", cancel_reason: why } });
    await kabarDeal(tx, d, "keduanya", "Tukar diajukan ke Syahbandar", why);
  });
}

/** Sistem mengirim deal ke Syahbandar (paket bermasalah / penahanan silang). */
export async function sengketaSistem(tx: Tx, d: DealRow, alasan: string, fault: Pihak | null = null) {
  pastikanBoleh(d.status, "system", "sengketa", d.mode);
  await tx.barterDeal.update({
    where: { id: d.id },
    data: { status: "disputed", cancel_reason: alasan, fault_party: fault },
  });
  await kabarDeal(tx, d, "keduanya", "Tukar diteruskan ke Syahbandar", alasan);
}

/** COD: pihak `userId` memindai/mengetik kode milik pihak lawan. Dua-duanya terpindai → selesai. */
export async function pindai(userId: string, dealId: string, input: string): Promise<{ done: boolean }> {
  const res = await prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    const p = pihakDari(d, userId);
    pastikanBoleh(d.status, p, "pindai", d.mode);
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

/** Kirim: pihak menyatakan barang lawan sudah diterima & sesuai. Dua-duanya (atau otomatis) → selesai. */
export async function konfirmasi(aktor: { userId: string } | "system", dealId: string): Promise<{ done: boolean }> {
  return prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    if (aktor === "system") {
      pastikanBoleh(d.status, "system", "konfirmasi", d.mode);
      await selesaikan(tx, d, "done", `Dikonfirmasi otomatis setelah paket sampai`);
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

/**
 * Dipanggil cron:
 * - tawaran/kesepakatan lewat batas waktu → kedaluwarsa, rekber kembali
 *   (kecuali paket sudah dibuat di kurir → Syahbandar);
 * - paket sampai lewat JAM_KONFIRMASI → selesai otomatis;
 * - penahanan silang: satu paket sudah jalan > JAM_PENAHANAN_SILANG, paket lain belum → Syahbandar.
 */
export async function majukanTukar(now = new Date()) {
  const hasil = { kedaluwarsa: 0, selesai: 0, sengketa: 0 };

  const due = await prisma.barterDeal.findMany({
    where: { status: { in: ["proposed", "agreed", "diterima"] }, expires_at: { lt: now } },
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
      if (d.status !== "proposed" && d.status !== "agreed") return null;
      if (d.shipments.some((s) => s.order_id && s.status !== "failed")) {
        await sengketaSistem(tx, d, "Batas waktu lewat tetapi sebagian paket sudah dibuat di kurir");
        return "sengketa" as const;
      }
      const why =
        d.status === "proposed"
          ? `Tawaran tidak dijawab ${HARI_TAWARAN} hari`
          : d.mode === "cod"
            ? `Tidak ketemuan dalam ${JAM_COD} jam`
            : `Ongkir tidak dilunasi dalam ${JAM_BAYAR_ONGKIR} jam`;
      // Pihak yang belum melunasi ongkir dicatat sebagai penyebab.
      const belumBayar =
        d.mode === "kirim" && d.status === "agreed"
          ? d.shipments.filter((s) => s.status === "quoted").map((s) => (s.payer_id === d.itemA.user_id ? "a" : "b"))
          : [];
      await batalkan(tx, d, "expired", why, belumBayar.length === 1 ? (belumBayar[0] as Pihak) : null);
      return "kedaluwarsa" as const;
    });
    if (r) hasil[r]++;
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
  return hasil;
}
