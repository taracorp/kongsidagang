import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { debit, levelFor, type Tx } from "@/lib/domain/pundi";
import { beriKabar } from "@/lib/domain/kabar-user";

// Belanja e-voucher lapak (dibayar Keteng).
// - Harga diambil dari DB; angka dari browser tidak dipakai sama sekali.
// - Satu transaksi: debit Pundi → Order + OrderItem → 1 Surat Jalan (voucher) berkode unik per unit.
// - E-voucher terikat cabang yang dipilih saat beli; ditebus petugas lapak di cabang itu.

const BEA_DASAR = 2000;
const MAKS_BARIS = 20;
const MAKS_QTY = 20;
const HURUF_KODE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // tanpa 0/O/1/I/L agar mudah dibaca petugas
const PANJANG_KODE = 10;

export function buatKodeVoucher(): string {
  let s = "";
  for (let i = 0; i < PANJANG_KODE; i++) s += HURUF_KODE[randomInt(HURUF_KODE.length)];
  return s;
}

/** Normalisasi input petugas: "abcde-fghjk" / "ABCDE FGHJK" → "ABCDEFGHJK". */
export function normalKode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Tampilan kode: 5-5 dipisah tanda hubung. */
export function tampilKode(code: string): string {
  return code.length === PANJANG_KODE ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

export type BarisBelanja = { productId: string; branchId?: string | null; qty: number };

/** Bea per transaksi: gratis untuk Tuan Besar/Juragan, atau tukar 10 Cap. */
async function hitungBea(tx: Tx, userId: string) {
  const prof = await tx.profile.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  if (prof.level === "tuan_besar" || prof.level === "juragan") return { prof, bea: 0, pakaiCap: false };
  if (prof.stamps >= 10) return { prof, bea: 0, pakaiCap: true };
  return { prof, bea: BEA_DASAR, pakaiCap: false };
}

/** Terbitkan kode unik (ulang bila kebetulan bentrok). */
async function kodeUnik(tx: Tx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = buatKodeVoucher();
    const ada = await tx.voucher.findUnique({ where: { code }, select: { id: true } });
    if (!ada) return code;
  }
  throw new Error("Gagal membuat kode voucher, coba lagi.");
}

function cekBaris(baris: BarisBelanja[]) {
  if (!Array.isArray(baris) || baris.length === 0) throw new Error("Keranjang kosong.");
  if (baris.length > MAKS_BARIS) throw new Error(`Maksimal ${MAKS_BARIS} jenis barang per transaksi.`);
  for (const b of baris) {
    if (!b.productId || !Number.isInteger(b.qty) || b.qty < 1 || b.qty > MAKS_QTY) {
      throw new Error(`Jumlah tiap barang 1–${MAKS_QTY}.`);
    }
  }
}

/**
 * Validasi keranjang + harga dari DB + bea, tanpa menulis apa pun (kecuali upsert profil kosong).
 * Dipakai oleh `belanja()` dan oleh Bayar Langsung untuk menghitung nominal.
 */
export async function siapkanBelanja(tx: Tx, userId: string, baris: BarisBelanja[]) {
  cekBaris(baris);
  // Harga & status diambil dari DB (berurutan: satu koneksi transaksi).
  const siap: {
    product: { id: string; name: string; price: number; valid_days: number; kind: string };
    merchant: { id: string; name: string; owner_id: string | null };
    branch: { id: string; name: string } | null;
    qty: number;
  }[] = [];
  for (const b of baris) {
    const p = await tx.merchantProduct.findUnique({
      where: { id: b.productId },
      select: {
        id: true,
        name: true,
        price: true,
        valid_days: true,
        kind: true,
        is_active: true,
        merchant: { select: { id: true, name: true, owner_id: true, is_active: true, status: true } },
      },
    });
    if (!p || !p.is_active || !p.merchant.is_active) throw new Error("Ada barang yang sudah tidak tersedia. Muat ulang keranjang.");
    if (p.merchant.status === "tutup" || p.merchant.status === "segera") throw new Error(`Lapak ${p.merchant.name} belum menerima pesanan.`);
    if (p.kind !== "evoucher") throw new Error(`${p.name} belum bisa dibeli lewat Kongsi.`);
    if (!b.branchId) throw new Error(`Pilih cabang untuk ${p.name}.`);
    const branch = await tx.merchantBranch.findFirst({
      where: { id: b.branchId, merchant_id: p.merchant.id, is_active: true },
      select: { id: true, name: true },
    });
    if (!branch) throw new Error(`Cabang untuk ${p.name} tidak tersedia. Pilih ulang cabang.`);
    siap.push({ product: p, merchant: p.merchant, branch, qty: b.qty });
  }
  const subtotal = siap.reduce((s, x) => s + x.product.price * x.qty, 0);
  const { prof, bea, pakaiCap } = await hitungBea(tx, userId);
  return { siap, subtotal, bea, total: subtotal + bea, prof, pakaiCap };
}

export async function belanja(userId: string, baris: BarisBelanja[]) {
  cekBaris(baris);
  return prisma.$transaction(
    async (tx) => {
      const { siap, subtotal, bea, total, prof, pakaiCap } = await siapkanBelanja(tx, userId, baris);
      await debit(tx, userId, total, "belanja", `Belanja e-voucher (${siap.reduce((s, x) => s + x.qty, 0)} voucher)`);

      const order = await tx.order.create({ data: { user_id: userId, subtotal, bea, total } });
      const now = Date.now();
      let jumlahVoucher = 0;
      for (const x of siap) {
        const item = await tx.orderItem.create({
          data: {
            order_id: order.id,
            product_id: x.product.id,
            merchant_id: x.merchant.id,
            branch_id: x.branch?.id ?? null,
            name: x.product.name,
            unit_price: x.product.price,
            qty: x.qty,
          },
        });
        for (let i = 0; i < x.qty; i++) {
          await tx.voucher.create({
            data: {
              user_id: userId,
              title: x.product.name,
              note: `${x.merchant.name}${x.branch ? ` · ${x.branch.name}` : ""}`,
              kind: "evoucher",
              code: await kodeUnik(tx),
              merchant_id: x.merchant.id,
              product_id: x.product.id,
              branch_id: x.branch?.id ?? null,
              order_item_id: item.id,
              expires_at: new Date(now + x.product.valid_days * 24 * 3600_000),
            },
          });
          jumlahVoucher++;
        }
        await tx.merchant.update({ where: { id: x.merchant.id }, data: { tebusan_count: { increment: x.qty } } });
      }

      const totalSpend = prof.total_spend + total;
      await tx.profile.update({
        where: { id: userId },
        data: {
          total_spend: totalSpend,
          stamps: pakaiCap ? prof.stamps - 10 + 1 : prof.stamps + 1,
          level: levelFor(totalSpend),
        },
      });
      await beriKabar(tx, userId, {
        kind: "voucher",
        title: `${jumlahVoucher} Surat Jalan terbit`,
        body: "Tunjukkan kodenya ke petugas di cabang yang kamu pilih.",
        href: "/pakhuis#surat-jalan",
      });
      return { orderId: order.id, total, bea, voucher: jumlahVoucher, pakaiCap };
    },
    { timeout: 20_000 },
  );
}

// ============================================================
// Validasi (tebus) oleh petugas lapak / admin
// ============================================================

export type HasilValidasi = { title: string; pemilik: string; cabang: string | null; kode: string };

/**
 * Petugas lapak menebus voucher. `merchantId` = lapak yang sedang dikelola petugas (sudah dicek kepemilikannya
 * oleh pemanggil), `branchId` = cabang tempat petugas berada.
 */
export async function tebusVoucherLapak(staffId: string, merchantId: string, branchId: string, input: string) {
  const code = normalKode(input);
  if (code.length !== PANJANG_KODE) throw new Error("Kode harus 10 karakter.");
  const hasil = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vouchers WHERE code = ${code} FOR UPDATE`;
    const v = await tx.voucher.findUnique({
      where: { code },
      include: { branch: { select: { id: true, name: true } }, user: { select: { name: true, email: true } } },
    });
    if (!v || v.merchant_id !== merchantId) throw new Error("Kode tidak dikenal untuk lapak ini.");
    if (v.status === "terpakai") {
      throw new Error(`Voucher sudah ditebus${v.redeemed_at ? ` pada ${v.redeemed_at.toLocaleString("id-ID")}` : ""}.`);
    }
    if (v.branch_id && v.branch_id !== branchId) throw new Error(`Voucher ini hanya berlaku di cabang ${v.branch?.name ?? "lain"}.`);
    if (v.expires_at && v.expires_at < new Date()) {
      // Status disimpan dulu (transaksi harus commit), galat dilempar di luar transaksi.
      await tx.voucher.updateMany({ where: { id: v.id, status: "aktif" }, data: { status: "kadaluarsa" } });
      return "kadaluarsa" as const;
    }
    if (v.status === "kadaluarsa") return "kadaluarsa" as const;
    if (v.status !== "aktif") throw new Error("Voucher tidak aktif.");
    await tx.voucher.update({
      where: { id: v.id },
      data: { status: "terpakai", redeemed_at: new Date(), redeemed_by: staffId },
    });
    await beriKabar(tx, v.user_id, {
      kind: "voucher",
      title: `Voucher ditebus: ${v.title}`,
      body: v.branch ? `Di ${v.branch.name}. Terima kasih!` : "Terima kasih!",
      href: "/pakhuis#surat-jalan",
    });
    return { title: v.title, pemilik: v.user.name || v.user.email, cabang: v.branch?.name ?? null, kode: tampilKode(code) } satisfies HasilValidasi;
  });
  if (hasil === "kadaluarsa") throw new Error("Voucher sudah kedaluwarsa.");
  return hasil;
}

/** Admin menebus voucher non-lapak (hadiah lelang). */
export async function tebusVoucherAdmin(adminId: string, input: string) {
  const code = normalKode(input);
  if (code.length !== PANJANG_KODE) throw new Error("Kode harus 10 karakter.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM vouchers WHERE code = ${code} FOR UPDATE`;
    const v = await tx.voucher.findUnique({ where: { code }, include: { user: { select: { name: true, email: true } } } });
    if (!v) throw new Error("Kode tidak dikenal.");
    if (v.merchant_id) throw new Error("Voucher lapak ditebus oleh petugas lapaknya.");
    if (v.status !== "aktif") throw new Error(`Voucher berstatus ${v.status}.`);
    if (v.expires_at && v.expires_at < new Date()) throw new Error("Voucher sudah kedaluwarsa.");
    await tx.voucher.update({ where: { id: v.id }, data: { status: "terpakai", redeemed_at: new Date(), redeemed_by: adminId } });
    await beriKabar(tx, v.user_id, { kind: "voucher", title: `Voucher ditebus: ${v.title}`, href: "/pakhuis#surat-jalan" });
    return { title: v.title, pemilik: v.user.name || v.user.email, cabang: null, kode: tampilKode(code) } satisfies HasilValidasi;
  });
}

/** Cron: voucher lewat masa berlaku → kadaluarsa. */
export async function kadaluarsakanVoucher(now = new Date()): Promise<number> {
  const r = await prisma.voucher.updateMany({
    where: { status: "aktif", expires_at: { lt: now } },
    data: { status: "kadaluarsa" },
  });
  return r.count;
}
