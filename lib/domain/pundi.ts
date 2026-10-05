import "server-only";
import { prisma } from "@/lib/db";
import type { UserLevel } from "@/lib/generated/prisma/client";

// Port dari plpgsql spend/topup/redeem/checkout/recompute_level (migrasi Supabase 0014 & 0015).
// Ambang level (akumulasi belanja, Rp): besar 250rb | tuan_kecil 1jt | tuan_besar 5jt | juragan 20jt.

export function levelFor(totalSpend: number): UserLevel {
  if (totalSpend >= 20_000_000) return "juragan";
  if (totalSpend >= 5_000_000) return "tuan_besar";
  if (totalSpend >= 1_000_000) return "tuan_kecil";
  if (totalSpend >= 250_000) return "pelanggan_besar";
  return "pelanggan_kecil";
}

const TOPUP_MAX = 1_000_000;
const BEA_DASAR = 2000;

/** Isi Pundi (DEMO — ganti DOKU di M6). Hanya aktif bila ENABLE_TOPUP_DEMO=true. */
export async function topupDemo(userId: string, amt: number): Promise<number> {
  if (process.env.ENABLE_TOPUP_DEMO !== "true") {
    throw new Error("Isi Pundi belum tersedia.");
  }
  if (!Number.isInteger(amt) || amt <= 0 || amt > TOPUP_MAX) {
    throw new Error("Jumlah tidak valid (maks 1jt demo)");
  }
  return prisma.$transaction(async (tx) => {
    const w = await tx.wallet.upsert({
      where: { user_id: userId },
      create: { user_id: userId, balance: amt },
      update: { balance: { increment: amt }, updated_at: new Date() },
    });
    await tx.walletTransaction.create({
      data: { user_id: userId, amount: amt, kind: "isi", note: "Isi Pundi (demo)" },
    });
    return w.balance;
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

/** Checkout pakai Keping + hak per-level + Cap; naikkan level otomatis. */
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

    // Kunci baris Pundi agar dua checkout bersamaan tidak membobol saldo.
    await tx.wallet.upsert({
      where: { user_id: userId },
      create: { user_id: userId, balance: 0 },
      update: {},
    });
    const [w] = await tx.$queryRaw<{ balance: number }[]>`
      SELECT balance FROM wallets WHERE user_id = ${userId} FOR UPDATE`;
    if (!w || w.balance < total) throw new Error("Saldo Keping tidak cukup");

    await tx.wallet.update({
      where: { user_id: userId },
      data: { balance: { decrement: total }, updated_at: new Date() },
    });
    await tx.walletTransaction.create({
      data: { user_id: userId, amount: -total, kind: "belanja", note: "Belanja Kongsi" },
    });

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
