import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, UserLevel } from "@/lib/generated/prisma/client";
import { findPackage } from "@/lib/pundi-paket";

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

/** Isi Pundi paket (DEMO — ganti DOKU di M6). Hanya aktif bila ENABLE_TOPUP_DEMO=true. */
export async function topupDemo(userId: string, packageId: string): Promise<number> {
  if (process.env.ENABLE_TOPUP_DEMO !== "true") {
    throw new Error("Isi Pundi belum tersedia.");
  }
  const pkg = findPackage(packageId);
  if (!pkg) throw new Error("Paket tidak dikenal");
  return prisma.$transaction(async (tx) => {
    let bal = await credit(tx, userId, pkg.price, "isi", `Isi Pundi paket ${pkg.name} (demo)`);
    const bonus = pkg.keteng - pkg.price;
    if (bonus > 0) bal = await credit(tx, userId, bonus, "bonus", `Bonus paket ${pkg.name}`);
    return bal;
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
