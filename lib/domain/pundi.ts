import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma, UserLevel } from "@/lib/generated/prisma/client";
import { randomBytes } from "node:crypto";
import { nominalIsi } from "@/lib/pundi-paket";
import { cariMetode, rincianBayar } from "@/lib/payment/biaya";
import { doku } from "@/lib/payment/doku";
import { beriKabar } from "@/lib/domain/kabar-user";

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
 * `pilihan` = nominal rupiah ("1500000"); Keteng masuk 1:1.
 */
export async function topupDemo(userId: string, pilihan: string): Promise<number> {
  if (process.env.ENABLE_TOPUP_DEMO !== "true") {
    throw new Error("Isi Pundi belum tersedia.");
  }
  const n = nominalIsi(pilihan);
  return prisma.$transaction((tx) => credit(tx, userId, n, "isi", `Isi Pundi Rp ${n.toLocaleString("id-ID")} (demo)`));
}

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

export function invoiceBaru(awalan = "KD-ISI") {
  return `${awalan}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type TujuanBayar = "isi" | "belanja" | "tukar_ajukan" | "tukar_terima" | "tukar_ongkir";

/**
 * Buat pesanan pembeli Keteng + sesi DOKU Checkout (Isi Pundi biasa maupun Bayar Langsung Tukar Guling).
 * Keteng yang masuk = `keteng`; pembeli membayar `keteng` + biaya DOKU metode terpilih (gross-up, termasuk PPN),
 * jadi Kongsi menerima bersih senilai Keteng yang diterbitkan. Tanpa platform fee, tanpa bonus.
 * Keteng BELUM masuk sampai pembayaran sukses.
 */
export async function buatPesananBayar(
  user: { id: string; name: string; email: string },
  r: { packageId: string; keteng: number; itemName: string; metode: string },
  callbackPath: (invoice: string) => string,
  siteUrl: string,
  tujuan: { tujuan: TujuanBayar; muatan?: Prisma.InputJsonValue } = { tujuan: "isi" },
): Promise<{ url: string; invoice: string }> {
  const drv = doku();
  if (!drv) throw new Error("Pembayaran DOKU belum tersedia.");
  const metode = cariMetode(r.metode);
  const { total, biaya } = rincianBayar(r.keteng, metode.kode);
  const pending = await prisma.topupOrder.count({
    where: { user_id: user.id, status: "pending", created_at: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (pending >= MAKS_PENDING_PER_JAM) throw new Error("Masih ada pembayaran yang menunggu. Selesaikan dulu atau tunggu 1 jam.");

  const invoice = invoiceBaru();
  const sesi = await drv.buatCheckout({
    invoice,
    amount: total,
    itemName: r.itemName,
    customer: { id: user.id, name: user.name || user.email, email: user.email },
    callbackUrl: `${siteUrl.replace(/\/$/, "")}${callbackPath(invoice)}`,
    dueMinutes: MENIT_BAYAR,
    metode: metode.kode,
    lineItems: [
      { name: r.itemName, price: r.keteng, quantity: 1 },
      { name: `Biaya pembayaran ${metode.nama}`, price: biaya, quantity: 1 },
    ],
  });
  await prisma.topupOrder.create({
    data: {
      user_id: user.id,
      invoice_number: invoice,
      package_id: r.packageId,
      price: total,
      keteng: r.keteng,
      biaya_bayar: biaya,
      metode: metode.kode,
      provider: drv.nama,
      payment_url: sesi.url,
      expires_at: sesi.expiresAt,
      tujuan: tujuan.tujuan,
      muatan: tujuan.muatan,
      tujuan_status: tujuan.tujuan === "isi" ? null : "menunggu",
    },
  });
  return { url: sesi.url, invoice };
}

/** Buat pesanan Isi Pundi + sesi DOKU Checkout. Keteng BELUM masuk sampai pembayaran sukses. */
export async function mulaiIsiPundi(
  user: { id: string; name: string; email: string },
  pilihan: string,
  metode: string,
  siteUrl: string,
): Promise<{ url: string; invoice: string }> {
  const n = nominalIsi(pilihan);
  return buatPesananBayar(
    user,
    { packageId: "nominal", keteng: n, metode, itemName: `Isi Pundi ${n.toLocaleString("id-ID")} Keteng` },
    (inv) => `/pakhuis?isi=${encodeURIComponent(inv)}`,
    siteUrl,
  );
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
    // Keteng yang masuk = o.keteng (biaya DOKU yang dibayar pembeli tidak menjadi Keteng).
    const nama = `${o.keteng.toLocaleString("id-ID")} Keteng`;
    const via = `${o.provider === "demo" ? "demo" : "DOKU"}${channel ? ` ${channel}` : ""}`;
    if (o.tujuan !== "isi") {
      // Bayar Langsung: Keteng masuk, lalu tujuannya dijalankan oleh jalankanTujuan (kabar dikirim di sana).
      await credit(tx, o.user_id, o.keteng, "isi", `Bayar langsung ${nama} (${via})`);
      return "lunas";
    }
    await credit(tx, o.user_id, o.keteng, "isi", `Isi Pundi ${nama} (${via})`);
    await beriKabar(tx, o.user_id, {
      kind: "pundi",
      title: `Isi Pundi berhasil: +${nama}`,
      body: o.biaya_bayar ? `Dibayar Rp ${o.price.toLocaleString("id-ID")} (termasuk biaya pembayaran Rp ${o.biaya_bayar.toLocaleString("id-ID")})` : null,
      href: "/pakhuis",
    });
    return "lunas";
  });
}

export async function gagalkanIsiPundi(invoice: string, status: "failed" | "expired") {
  const o = await prisma.topupOrder.findUnique({ where: { invoice_number: invoice }, select: { user_id: true } });
  const r = await prisma.topupOrder.updateMany({ where: { invoice_number: invoice, status: "pending" }, data: { status } });
  if (r.count && o) {
    await beriKabar(prisma, o.user_id, {
      kind: "pundi",
      title: status === "failed" ? "Isi Pundi gagal" : "Isi Pundi kedaluwarsa",
      body: "Keteng tidak berubah. Silakan coba lagi.",
      href: "/pakhuis",
    });
  }
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

// Belanja & tebus voucher: lihat lib/domain/belanja.ts (harga dari DB, kode unik, validasi petugas).
