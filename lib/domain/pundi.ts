import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, UserLevel } from "@/lib/generated/prisma/client";
import { randomBytes } from "node:crypto";
import { findPackage, rincianIsi } from "@/lib/pundi-paket";
import { doku } from "@/lib/payment/doku";

// Port dari plpgsql spend/topup/redeem/checkout/recompute_level (migrasi Supabase 0014 & 0015).
// Ambang level (akumulasi belanja, Rp): besar 250rb | tuan_kecil 1jt | tuan_besar 5jt | juragan 20jt.

export type Tx = Prisma.TransactionClient;

export function levelFor(totalSpend: number): UserLevel {
  if (totalSpend >= 20_000_000) return "juragan";
  if (totalSpend >= 5_000_000) return "tuan_besar";
  if (totalSpend >= 1_000_000) return "tuan_kecil";
  if (totalSpend >= 250_000) return "pelanggan_besar";
  return "pelanggan_kecil";
}

const BEA_DASAR = 2000;

// ============================================================
// Ledger: semua mutasi Keteng lewat helper ini, di dalam $transaction.
// ============================================================

function assertAmount(amt: number) {
  if (!Number.isInteger(amt) || amt <= 0) throw new Error("Jumlah Keteng tidak valid");
}

/** Kunci baris Pundi (buat bila belum ada) agar mutasi bersamaan tidak membobol saldo. */
async function lockWallet(tx: Tx, userId: string): Promise<number> {
  await tx.wallet.upsert({
    where: { user_id: userId },
    create: { user_id: userId, balance: 0 },
    update: {},
  });
  const [w] = await tx.$queryRaw<{ balance: number }[]>`
    SELECT balance FROM wallets WHERE user_id = ${userId} FOR UPDATE`;
  return w?.balance ?? 0;
}

export async function credit(tx: Tx, userId: string, amt: number, kind: string, note: string) {
  assertAmount(amt);
  await lockWallet(tx, userId);
  const w = await tx.wallet.update({
    where: { user_id: userId },
    data: { balance: { increment: amt }, updated_at: new Date() },
  });
  await tx.walletTransaction.create({ data: { user_id: userId, amount: amt, kind, note } });
  return w.balance;
}

export async function debit(tx: Tx, userId: string, amt: number, kind: string, note: string) {
  assertAmount(amt);
  const bal = await lockWallet(tx, userId);
  if (bal < amt) throw new Error("Saldo Keteng tidak cukup");
  const w = await tx.wallet.update({
    where: { user_id: userId },
    data: { balance: { decrement: amt }, updated_at: new Date() },
  });
  await tx.walletTransaction.create({ data: { user_id: userId, amount: -amt, kind, note } });
  return w.balance;
}

export type HoldKind = "bea" | "tambah" | "deposit" | "ongkir";

/** Tahan Keteng ke rekber: saldo dipotong sekarang, nasibnya ditentukan saat deal selesai. */
export async function hold(
  tx: Tx,
  userId: string,
  dealId: string | null,
  amt: number,
  kind: HoldKind,
  note: string,
) {
  await debit(tx, userId, amt, "tahan", note);
  return tx.walletHold.create({ data: { user_id: userId, deal_id: dealId, amount: amt, kind } });
}

/** Ambil hold yang masih ditahan (status berubah atomik → aman dari selesai ganda). */
async function settle(tx: Tx, holdId: string, status: "diambil" | "dilepas" | "dikembalikan") {
  const res = await tx.walletHold.updateMany({
    where: { id: holdId, status: "ditahan" },
    data: { status, settled_at: new Date() },
  });
  if (res.count === 0) throw new Error("Rekber sudah diselesaikan");
  return tx.walletHold.findUniqueOrThrow({ where: { id: holdId } });
}

/** Hold jadi pendapatan platform (mis. bea). Saldo sudah terpotong saat ditahan. */
export async function captureHold(tx: Tx, holdId: string, kind = "bea_tukar", note = "Bea Tukar Guling") {
  const h = await settle(tx, holdId, "diambil");
  await tx.walletTransaction.create({ data: { user_id: h.user_id, amount: 0, kind, note } });
  return h;
}

/** Hold dipindah ke pihak lain (mis. tambah Keteng ke penerima). */
export async function releaseHold(tx: Tx, holdId: string, toUserId: string, note: string) {
  const h = await settle(tx, holdId, "dilepas");
  await credit(tx, toUserId, h.amount, "terima_tukar", note);
  return h;
}

/** Hold kembali ke pemiliknya. */
export async function refundHold(tx: Tx, holdId: string, note: string) {
  const h = await settle(tx, holdId, "dikembalikan");
  await credit(tx, h.user_id, h.amount, "lepas", note);
  return h;
}

// ============================================================
// Isi Pundi
// ============================================================

/**
 * Isi Pundi DEMO (tanpa pembayaran). Hanya aktif bila ENABLE_TOPUP_DEMO=true.
 * `pilihan` = id paket ("pedagang") atau nominal rupiah ("1500000").
 */
export async function topupDemo(userId: string, pilihan: string): Promise<number> {
  if (process.env.ENABLE_TOPUP_DEMO !== "true") {
    throw new Error("Isi Pundi belum tersedia.");
  }
  const r = rincianIsi(pilihan);
  return prisma.$transaction(async (tx) => {
    let bal = await credit(tx, userId, r.price, "isi", `Isi Pundi ${labelIsi(r)} (demo)`);
    const bonus = r.keteng - r.price;
    if (bonus > 0) bal = await credit(tx, userId, bonus, "bonus", `Bonus paket ${r.name}`);
    return bal;
  });
}

const labelIsi = (r: { packageId: string; name: string }) => (r.packageId === "nominal" ? r.name : `paket ${r.name}`);

// ============================================================
// Isi Pundi lewat DOKU Checkout
// ============================================================

const MENIT_BAYAR = 60;
const MAKS_PENDING_PER_JAM = 3;

export function isiPundiTersedia(): "doku" | "demo" | null {
  if (doku()) return "doku";
  if (process.env.ENABLE_TOPUP_DEMO === "true") return "demo";
  return null;
}

function invoiceBaru() {
  return `KD-ISI-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Buat pesanan Isi Pundi + sesi DOKU Checkout. Keteng BELUM masuk sampai pembayaran sukses. */
export async function mulaiIsiPundi(
  user: { id: string; name: string; email: string },
  pilihan: string,
  siteUrl: string,
): Promise<{ url: string; invoice: string }> {
  const drv = doku();
  if (!drv) throw new Error("Pembayaran DOKU belum tersedia.");
  const pkg = rincianIsi(pilihan);
  const pending = await prisma.topupOrder.count({
    where: { user_id: user.id, status: "pending", created_at: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (pending >= MAKS_PENDING_PER_JAM) throw new Error("Masih ada pembayaran yang menunggu. Selesaikan dulu atau tunggu 1 jam.");

  const invoice = invoiceBaru();
  const sesi = await drv.buatCheckout({
    invoice,
    amount: pkg.price,
    itemName: `Isi Pundi ${labelIsi(pkg)} (${pkg.keteng.toLocaleString("id-ID")} Keteng)`,
    customer: { id: user.id, name: user.name || user.email, email: user.email },
    callbackUrl: `${siteUrl.replace(/\/$/, "")}/pakhuis?isi=${encodeURIComponent(invoice)}`,
    dueMinutes: MENIT_BAYAR,
  });
  await prisma.topupOrder.create({
    data: {
      user_id: user.id,
      invoice_number: invoice,
      package_id: pkg.packageId,
      price: pkg.price,
      keteng: pkg.keteng,
      provider: drv.nama,
      payment_url: sesi.url,
      expires_at: sesi.expiresAt,
    },
  });
  return { url: sesi.url, invoice };
}

/**
 * Pembayaran sukses (notifikasi DOKU / cek status). Idempoten: status diubah atomik pending→paid,
 * jadi notifikasi ganda tidak mengkredit dua kali. Nominal wajib sama dengan harga paket.
 */
export async function lunasiIsiPundi(invoice: string, amount: number, channel: string | null): Promise<"lunas" | "sudah" | "tolak"> {
  return prisma.$transaction(async (tx) => {
    const o = await tx.topupOrder.findUnique({ where: { invoice_number: invoice } });
    if (!o) return "tolak";
    if (o.status === "paid") return "sudah";
    if (Math.round(amount) !== o.price) return "tolak";
    const res = await tx.topupOrder.updateMany({
      where: { id: o.id, status: { in: ["pending", "expired", "failed"] } },
      data: { status: "paid", paid_at: new Date(), channel },
    });
    if (res.count !== 1) return "sudah";
    const pkg = findPackage(o.package_id);
    const nama = pkg ? `paket ${pkg.name}` : `Rp ${o.price.toLocaleString("id-ID")}`;
    await credit(tx, o.user_id, o.price, "isi", `Isi Pundi ${nama} (DOKU${channel ? ` ${channel}` : ""})`);
    if (o.keteng > o.price) await credit(tx, o.user_id, o.keteng - o.price, "bonus", `Bonus ${nama}`);
    return "lunas";
  });
}

export async function gagalkanIsiPundi(invoice: string, status: "failed" | "expired") {
  await prisma.topupOrder.updateMany({ where: { invoice_number: invoice, status: "pending" }, data: { status } });
}

/** Cocokkan pesanan milik user dengan status di DOKU (bila notifikasi terlambat). */
export async function rekonsiliasiIsiPundi(userId: string, invoice: string) {
  const o = await prisma.topupOrder.findFirst({ where: { invoice_number: invoice, user_id: userId } });
  if (!o) return null;
  if (o.status === "pending") {
    const drv = doku();
    if (drv && drv.nama === o.provider) {
      const st = await drv.cekStatus(invoice).catch(() => null);
      if (st?.status === "SUCCESS" && st.amount != null) await lunasiIsiPundi(invoice, st.amount, st.channel);
      else if (st?.status === "FAILED" || st?.status === "EXPIRED") await gagalkanIsiPundi(invoice, st.status === "FAILED" ? "failed" : "expired");
      else if (o.expires_at < new Date()) await gagalkanIsiPundi(invoice, "expired");
    }
  }
  return prisma.topupOrder.findUnique({
    where: { id: o.id },
    select: { invoice_number: true, status: true, price: true, keteng: true, package_id: true },
  });
}

/** Tebus Surat Jalan milik sendiri yang masih aktif. */
export async function redeemVoucher(userId: string, voucherId: string) {
  await prisma.$transaction(async (tx) => {
    const res = await tx.voucher.updateMany({
      where: { id: voucherId, user_id: userId, status: "aktif" },
      data: { status: "terpakai" },
    });
    if (res.count === 0) throw new Error("Voucher tidak bisa ditebus");
    const v = await tx.voucher.findUnique({ where: { id: voucherId }, select: { title: true } });
    await tx.walletTransaction.create({
      data: {
        user_id: userId,
        amount: 0,
        kind: "tebus",
        note: `Tebus Surat Jalan: ${v?.title ?? ""}`,
      },
    });
  });
}

/** Checkout pakai Keteng + hak per-level + Cap; naikkan level otomatis. */
export async function checkoutKeping(
  userId: string,
  subtotal: number,
  ongkir = 0,
): Promise<{ paid: number; bea: number; used_stamp: boolean }> {
  if (!Number.isInteger(subtotal) || subtotal <= 0) throw new Error("Keranjang kosong");
  if (!Number.isInteger(ongkir) || ongkir < 0) throw new Error("Ongkir tidak valid");

  return prisma.$transaction(async (tx) => {
    const prof = await tx.profile.upsert({
      where: { id: userId },
      create: { id: userId },
      update: {},
    });

    let bea = BEA_DASAR;
    let usedStamp = false;
    if (prof.level === "tuan_besar" || prof.level === "juragan") {
      bea = 0; // hak level
    } else if (prof.stamps >= 10) {
      bea = 0; // tukar 10 Cap
      usedStamp = true;
    }
    const total = subtotal + ongkir + bea;

    await debit(tx, userId, total, "belanja", "Belanja Kongsi");

    const totalSpend = prof.total_spend + total;
    await tx.profile.update({
      where: { id: userId },
      data: {
        total_spend: totalSpend,
        stamps: usedStamp ? prof.stamps - 10 + 1 : prof.stamps + 1,
        level: levelFor(totalSpend),
      },
    });

    return { paid: total, bea, used_stamp: usedStamp };
  });
}
