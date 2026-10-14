import "server-only";
import { prisma } from "@/lib/db";
import type { Tx } from "@/lib/domain/pundi";
import { beriKabar } from "@/lib/domain/kabar-user";
import { buatPesanan } from "@/lib/domain/belanja";
import { BIAYA_TRANSFER, tenggatBayar } from "@/lib/domain/tukar-aturan";
import { isSuperadminEmail } from "@/lib/roles";
import { broadcastLelang } from "@/lib/realtime";

// Balai Lelang v2 (Fase 4, Ch 8.39) — Kongsi tidak pernah menanggung barang lelang yang tidak dibayar.
// - Barang = produk e-voucher lapak (MerchantProduct). deal_price = hak lapak; set_price = harga yang ditebak & DIBAYAR
//   pemenang (wajib ≥ deal_price + biaya transfer setoran); margin = pendapatan Kongsi.
// - Sekali jalan: draf → kumpul → tebak → jeda → final → pemenang → bayar → selesai | gagal | batal. Tebakan disimpan.
// - Pemenang = tebakan terakhir tiap peserta yang paling dekat set_price; seri → tebakan paling awal. Peringkat 1–3
//   dicatat di auction_hak (unik per lelang & per user → anti-dobel).
// - Pemenang membayar set_price + platform fee + biaya DOKU lewat pesanan belanja (pilih cabang) dalam tenggat 12 jam
//   (tidak jatuh di jam tidur). Voucher lapak terbit HANYA setelah lunas. Tidak bayar → hak hangus, turun ke peringkat
//   berikutnya; tidak ada yang bayar → lelang gagal (tanpa kewajiban apa pun ke lapak).
// - Pengurus (yang tahu harga rahasia) & pemilik lapak barang itu tidak boleh ikut.

export const STATUS_LELANG = ["draf", "kumpul", "tebak", "jeda", "final", "pemenang", "bayar", "selesai", "gagal", "batal"] as const;
export const STATUS_PUBLIK = ["kumpul", "tebak", "jeda", "final", "pemenang", "bayar"];
const STATUS_BOLEH_BATAL = ["draf", "kumpul", "tebak", "jeda", "final"];
const NEXT: Record<string, string> = { kumpul: "tebak", tebak: "jeda", jeda: "final", final: "pemenang", pemenang: "bayar" };
const PHASE_MS = 60_000;
const HARI = 86_400_000;
export const MAKS_PERINGKAT = 3;
export const BATAS_HANGUS = 2; // 2 hak hangus dalam 30 hari → tidak bisa ikut lelang 30 hari
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const jamWib = (t: Date) => t.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit" });

// ============================================================
// Pengurus
// ============================================================

export type LelangBaru = {
  productId: string;
  type: "reguler" | "vendu";
  clueCategory: string;
  clueNameMasked: string;
  normalPrice: number;
  dealPrice: number;
  setPrice: number;
  capacity: number;
  facilities: string[];
  durasiKumpul?: number; // menit (default 30)
  durasiTebak?: number; // menit (default 60)
};

export async function buatLelang(adminId: string, i: LelangBaru) {
  const p = await prisma.merchantProduct.findUnique({
    where: { id: i.productId },
    include: { merchant: { select: { id: true, owner_id: true, is_active: true } } },
  });
  if (!p || !p.is_active || !p.merchant.is_active || p.kind !== "evoucher") throw new Error("Pilih produk e-voucher aktif dari lapak aktif.");
  if (p.merchant.owner_id === adminId) throw new Error("Tidak boleh melelang produk lapakmu sendiri.");
  const angka = [i.normalPrice, i.dealPrice, i.setPrice, i.capacity];
  if (angka.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error("Harga & kapasitas harus angka bulat positif.");
  if (i.setPrice < i.dealPrice + BIAYA_TRANSFER) {
    throw new Error(`Harga set minimal harga deal + ${rp(BIAYA_TRANSFER)} (biaya transfer setoran) — Kongsi tidak boleh rugi.`);
  }
  if (i.normalPrice < i.setPrice) throw new Error("Harga normal tidak boleh di bawah harga set.");
  const clue = i.clueCategory.trim().slice(0, 80);
  const samar = i.clueNameMasked.trim().slice(0, 40);
  if (clue.length < 3 || samar.length < 2) throw new Error("Isi clue kategori & nama samaran lapak.");
  return prisma.auction.create({
    data: {
      type: i.type === "vendu" ? "vendu" : "reguler",
      status: "draf",
      clue_category: clue,
      clue_name_masked: samar,
      normal_price: i.normalPrice,
      deal_price: i.dealPrice,
      set_price: i.setPrice,
      capacity: Math.min(1000, i.capacity),
      durasi_kumpul: Math.min(1440, Math.max(1, Math.floor(i.durasiKumpul ?? 30))),
      durasi_tebak: Math.min(1440, Math.max(1, Math.floor(i.durasiTebak ?? 60))),
      facilities: i.facilities.map((f) => f.trim().slice(0, 80)).filter(Boolean).slice(0, 8),
      merchant_id: p.merchant.id,
      product_id: p.id,
      dibuat_oleh: adminId,
    },
  });
}

export async function mulaiLelang(adminId: string, id: string) {
  const a = await prisma.auction.findUnique({ where: { id }, select: { durasi_kumpul: true } });
  const r = await prisma.auction.updateMany({
    where: { id, status: "draf" },
    data: { status: "kumpul", starts_at: new Date(), phase_ends_at: new Date(Date.now() + (a?.durasi_kumpul ?? 30) * 60_000), dimulai_oleh: adminId },
  });
  if (r.count !== 1) throw new Error("Hanya lelang berstatus draf yang bisa dimulai.");
  broadcastLelang();
}

/** Batalkan sebelum pemenang ditentukan (setelah itu hanya lewat jalur bayar/gagal). */
export async function batalkanLelang(adminId: string, id: string, alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 300);
  if (why.length < 10) throw new Error("Tulis alasan pembatalan (minimal 10 huruf).");
  const r = await prisma.auction.updateMany({
    where: { id, status: { in: STATUS_BOLEH_BATAL } },
    data: { status: "batal", phase_ends_at: null, dibatalkan_oleh: adminId, batal_alasan: why },
  });
  if (r.count !== 1) throw new Error("Lelang tidak bisa dibatalkan setelah pemenang ditentukan.");
  broadcastLelang();
}

// ============================================================
// Peserta
// ============================================================

/** Sampai kapan user tidak boleh ikut lelang (2 hak hangus dalam 30 hari → 30 hari). */
export async function blokirLelang(userId: string, now = new Date()): Promise<Date | null> {
  const rows = await prisma.auctionHak.findMany({
    where: { user_id: userId, status: "hangus", tenggat: { gt: new Date(now.getTime() - 60 * HARI) } },
    orderBy: { tenggat: "asc" },
    select: { tenggat: true },
  });
  let sampai: Date | null = null;
  for (let i = BATAS_HANGUS - 1; i < rows.length; i++) {
    const a = rows[i - BATAS_HANGUS + 1].tenggat!, b = rows[i].tenggat!;
    if (b.getTime() - a.getTime() <= 30 * HARI) {
      const s = new Date(b.getTime() + 30 * HARI);
      if (!sampai || s > sampai) sampai = s;
    }
  }
  return sampai && sampai > now ? sampai : null;
}

const BUKA = ["kumpul", "tebak"];

/** Admin / Ketua / superadmin terverifikasi — tahu harga rahasia. */
async function pengurus(userId: string) {
  const [staf, u] = await Promise.all([
    prisma.staffRole.findUnique({ where: { user_id: userId }, select: { role: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } }),
  ]);
  return staf?.role === "admin" || staf?.role === "ketua" || Boolean(u?.emailVerified && isSuperadminEmail(u.email));
}

async function pastikanPeserta(auctionId: string, userId: string) {
  const a = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { status: true, capacity: true, merchant: { select: { owner_id: true } }, _count: { select: { participants: true } } },
  });
  if (!a) throw new Error("Lelang tidak ditemukan.");
  if (!BUKA.includes(a.status)) throw new Error("Lelang sedang tidak menerima peserta.");
  if (await pengurus(userId)) throw new Error("Pengurus Kongsi tidak boleh ikut lelang (mengetahui harga rahasia).");
  if (a.merchant?.owner_id === userId) throw new Error("Pemilik lapak tidak boleh ikut lelang barangnya sendiri.");
  const blok = await blokirLelang(userId);
  if (blok) throw new Error(`Kamu belum bisa ikut lelang sampai ${blok.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })} (tidak membayar kemenangan sebelumnya).`);
  const sudah = await prisma.auctionParticipant.findUnique({ where: { auction_id_user_id: { auction_id: auctionId, user_id: userId } } });
  if (!sudah) {
    if (a._count.participants >= a.capacity) throw new Error("Kursi peserta lelang ini sudah penuh.");
    await prisma.auctionParticipant.create({ data: { auction_id: auctionId, user_id: userId } });
  }
}

export async function ikut(userId: string, auctionId: string) {
  await pastikanPeserta(auctionId, userId);
}

export async function tebak(userId: string, auctionId: string, guess: number) {
  if (!Number.isInteger(guess) || guess <= 0 || guess > 1_000_000_000) throw new Error("Isi tebakan harga.");
  await pastikanPeserta(auctionId, userId);
  await prisma.auctionGuess.create({ data: { auction_id: auctionId, user_id: userId, round: 1, guess } });
}

// ============================================================
// Pemenang & hak bayar
// ============================================================

/** Tentukan peringkat 1–3 (tebakan terakhir tiap peserta; terdekat menang, seri → tebakan paling awal). */
async function tentukanPemenang(tx: Tx, auctionId: string, now: Date): Promise<boolean> {
  const a = await tx.auction.findUnique({ where: { id: auctionId }, select: { set_price: true, clue_category: true } });
  if (!a || a.set_price == null) return false;
  const sp = a.set_price;
  const guesses = await tx.auctionGuess.findMany({
    where: { auction_id: auctionId },
    select: { user_id: true, guess: true, created_at: true },
    orderBy: { created_at: "desc" },
  });
  const terakhir = new Map<string, { guess: number; at: Date }>();
  for (const g of guesses) if (!terakhir.has(g.user_id)) terakhir.set(g.user_id, { guess: g.guess, at: g.created_at });
  const urut = [...terakhir.entries()]
    .sort(([, x], [, y]) => Math.abs(x.guess - sp) - Math.abs(y.guess - sp) || x.at.getTime() - y.at.getTime())
    .slice(0, MAKS_PERINGKAT);
  if (!urut.length) return false;
  const tenggat = tenggatBayar(now);
  for (const [i, [userId, g]] of urut.entries()) {
    await tx.auctionHak.create({
      data: { auction_id: auctionId, user_id: userId, peringkat: i + 1, guess: g.guess, status: i === 0 ? "menunggu" : "antri", tenggat: i === 0 ? tenggat : null },
    });
  }
  await tx.auction.update({ where: { id: auctionId }, data: { winner_id: urut[0][0], winning_guess: urut[0][1].guess } });
  await beriKabar(tx, urut[0][0], {
    kind: "lelang",
    title: `Kamu menang lelang: ${a.clue_category} 🎉`,
    body: `Bayar ${rp(sp)} + biaya sebelum ${jamWib(tenggat)} WIB untuk mendapatkan Surat Jalan. Lewat batas → hak pindah ke peringkat berikutnya.`,
    href: `/lelang/bayar/${auctionId}`,
  });
  return true;
}

/** Hak yang sedang berlaku (menunggu bayar) milik user di lelang ini. */
async function hakBerlaku(userId: string, auctionId: string) {
  return prisma.auctionHak.findFirst({ where: { auction_id: auctionId, user_id: userId, status: "menunggu" } });
}

/** Ada pesanan bayar lelang yang masih berjalan untuk hak ini? (tunggu sebelum hangus) */
async function bayarBerjalan(tx: Tx, auctionId: string, userId: string, now: Date) {
  const o = await tx.order.findFirst({
    where: { auction_id: auctionId, user_id: userId, status: "menunggu", expires_at: { gt: new Date(now.getTime() - 15 * 60_000) } },
    select: { id: true },
  });
  return Boolean(o);
}

/** Pemenang memilih cabang & metode → pesanan belanja (harga set) + DOKU. Voucher terbit setelah lunas. */
export async function mulaiBayarLelang(
  user: { id: string; name: string; email: string },
  auctionId: string,
  branchId: string,
  metode: string,
  siteUrl: string,
) {
  const hak = await hakBerlaku(user.id, auctionId);
  if (!hak || !hak.tenggat) throw new Error("Kamu tidak sedang memegang hak beli lelang ini.");
  const sisaMenit = Math.floor((hak.tenggat.getTime() - Date.now()) / 60_000) - 5;
  if (sisaMenit < 10) throw new Error("Waktu pembayaran hampir habis.");
  const a = await prisma.auction.findUniqueOrThrow({
    where: { id: auctionId },
    include: { product: true, merchant: { select: { id: true, name: true } } },
  });
  if (a.status !== "bayar" && a.status !== "pemenang") throw new Error("Lelang ini tidak sedang menunggu pembayaran.");
  if (!a.product || !a.merchant || a.set_price == null || a.deal_price == null) throw new Error("Data lelang tidak lengkap.");
  const b = await prisma.merchantBranch.findFirst({ where: { id: branchId, merchant_id: a.merchant.id, is_active: true } });
  if (!b) throw new Error("Pilih cabang yang tersedia.");
  const ada = await prisma.order.findFirst({
    where: { auction_id: auctionId, user_id: user.id, status: "menunggu", expires_at: { gt: new Date() } },
    select: { payment_url: true, invoice_number: true, metode: true },
  });
  if (ada?.payment_url && ada.metode === metode) return { url: ada.payment_url, invoice: ada.invoice_number! };
  if (ada) throw new Error("Masih ada tagihan lelang yang menunggu dibayar.");
  return buatPesanan(
    user,
    [
      {
        product_id: a.product.id,
        merchant_id: a.merchant.id,
        branch_id: b.id,
        name: `${a.product.name} (lelang)`,
        branchName: b.name,
        unit_price: a.set_price,
        qty: 1,
        valid_days: a.product.valid_days,
        titipan: a.deal_price, // hak lapak = harga deal; selisihnya margin Kongsi
      },
    ],
    metode,
    siteUrl,
    { auctionId, menit: sisaMenit },
  );
}

/** Data halaman bayar pemenang (hanya pemegang hak). */
export async function dataBayarLelang(userId: string, auctionId: string) {
  const hak = await prisma.auctionHak.findFirst({ where: { auction_id: auctionId, user_id: userId } });
  if (!hak) return null;
  const a = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      product: { select: { name: true, valid_days: true } },
      merchant: { select: { name: true, branches: { where: { is_active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, address: true } } } },
    },
  });
  if (!a || a.set_price == null) return null;
  return {
    status: hak.status,
    peringkat: hak.peringkat,
    tenggat: hak.tenggat?.toISOString() ?? null,
    harga: a.set_price,
    clue: a.clue_category,
    produk: a.product?.name ?? a.clue_category,
    lapak: a.merchant?.name ?? "",
    masaBerlaku: a.product?.valid_days ?? 90,
    cabang: a.merchant?.branches ?? [],
  };
}

// ============================================================
// Cron
// ============================================================

/** Majukan fase yang waktunya habis + kelola hak bayar (dipanggil cron tiap menit). */
export async function advanceAuctions(now = new Date()): Promise<number> {
  let n = 0;
  const due = await prisma.auction.findMany({
    where: { status: { in: Object.keys(NEXT) }, phase_ends_at: { not: null, lt: now } },
    select: { id: true, status: true, durasi_tebak: true },
  });
  for (const r of due) {
    const next = NEXT[r.status];
    // Fase tebak pakai durasi lelang; jeda/final/pemenang tetap 1 menit.
    const durasiMs = next === "tebak" ? r.durasi_tebak * 60_000 : PHASE_MS;
    await prisma.$transaction(async (tx) => {
      const klaim = await tx.auction.updateMany({
        where: { id: r.id, status: r.status },
        data: { status: next, phase_ends_at: next === "bayar" ? null : new Date(now.getTime() + durasiMs) },
      });
      if (klaim.count !== 1) return;
      if (next === "pemenang" && !(await tentukanPemenang(tx, r.id, now))) {
        await tx.auction.update({ where: { id: r.id }, data: { status: "gagal", phase_ends_at: null, batal_alasan: "Tidak ada tebakan" } });
      }
    });
    n++;
  }

  // Hak bayar lewat tenggat → hangus → peringkat berikutnya; habis → lelang gagal.
  const telat = await prisma.auctionHak.findMany({ where: { status: "menunggu", tenggat: { lt: now } }, select: { id: true } });
  for (const { id } of telat) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auction_hak WHERE id = ${id} FOR UPDATE`;
      const h = await tx.auctionHak.findUnique({ where: { id }, include: { auction: { select: { clue_category: true, set_price: true } } } });
      if (!h || h.status !== "menunggu" || !h.tenggat || h.tenggat >= now) return;
      if (await bayarBerjalan(tx, h.auction_id, h.user_id, now)) return;
      await tx.auctionHak.update({ where: { id }, data: { status: "hangus" } });
      await beriKabar(tx, h.user_id, {
        kind: "lelang",
        title: `Hak beli lelang hangus: ${h.auction.clue_category}`,
        body: `Tidak dibayar sebelum batas waktu. ${BATAS_HANGUS} kali dalam 30 hari = tidak bisa ikut lelang 30 hari.`,
        href: "/lelang",
      });
      const berikut = await tx.auctionHak.findFirst({ where: { auction_id: h.auction_id, status: "antri" }, orderBy: { peringkat: "asc" } });
      if (berikut) {
        const tenggat = tenggatBayar(now);
        await tx.auctionHak.update({ where: { id: berikut.id }, data: { status: "menunggu", tenggat } });
        await tx.auction.update({ where: { id: h.auction_id }, data: { winner_id: berikut.user_id, winning_guess: berikut.guess } });
        await beriKabar(tx, berikut.user_id, {
          kind: "lelang",
          title: `Hak beli lelang pindah ke kamu (peringkat ${berikut.peringkat})`,
          body: `${h.auction.clue_category}: bayar ${rp(h.auction.set_price ?? 0)} + biaya sebelum ${jamWib(tenggat)} WIB.`,
          href: `/lelang/bayar/${h.auction_id}`,
        });
      } else {
        await tx.auction.update({
          where: { id: h.auction_id },
          data: { status: "gagal", phase_ends_at: null, batal_alasan: "Tidak ada pemenang yang membayar", winner_id: null },
        });
      }
      n++;
    });
  }

  // Pengingat 2 jam sebelum tenggat.
  const ingat = await prisma.auctionHak.findMany({
    where: { status: "menunggu", pengingat_at: null, tenggat: { gt: now, lt: new Date(now.getTime() + 2 * 3600_000) } },
    include: { auction: { select: { clue_category: true } } },
  });
  for (const h of ingat) {
    const r = await prisma.auctionHak.updateMany({ where: { id: h.id, pengingat_at: null }, data: { pengingat_at: now } });
    if (r.count) {
      await beriKabar(prisma, h.user_id, {
        kind: "lelang",
        title: "⏰ 2 jam lagi batas bayar lelang",
        body: h.auction.clue_category,
        href: `/lelang/bayar/${h.auction_id}`,
      });
    }
  }
  if (n) broadcastLelang();
  return n;
}
