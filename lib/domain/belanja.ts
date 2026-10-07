import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { invoiceBaru, isiPundiTersedia, levelFor, type Tx } from "@/lib/domain/pundi";
import { beriKabar } from "@/lib/domain/kabar-user";
import { doku } from "@/lib/payment/doku";
import { cariMetode, platformFee, rincianBayar } from "@/lib/payment/biaya";

// Belanja e-voucher lapak — dibayar UANG lewat DOKU (sejak 7 Okt 2026 Keteng hanya untuk Tukar Guling).
// - Harga diambil dari DB; angka dari browser tidak dipakai sama sekali.
// - Tagihan = harga voucher (titipan milik lapak) + platform fee (pendapatan Kongsi, + PPN bila PKP)
//   + biaya pembayaran DOKU metode terpilih (gross-up, termasuk PPN; ditanggung pembeli).
//   Hasilnya: setelah dipotong DOKU, Kongsi menerima bersih harga voucher + platform fee.
// - Pesanan dibuat "menunggu" lengkap dengan snapshot harga; Surat Jalan terbit saat DOKU mengabarkan lunas.
// - E-voucher terikat cabang yang dipilih saat beli; ditebus petugas lapak di cabang itu.

const MAKS_BARIS = 20;
const MAKS_QTY = 20;
const MENIT_BAYAR = 60;
const MAKS_MENUNGGU_PER_JAM = 3;
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

/** Kongsi sudah PKP? (platform fee + PPN 11%). Default: belum. */
export const sudahPkp = () => process.env.KONGSI_PKP === "true";

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

/** Validasi keranjang + harga dari DB (tanpa menulis apa pun). */
export async function siapkanBelanja(tx: Tx, baris: BarisBelanja[]) {
  cekBaris(baris);
  // Berurutan: satu koneksi transaksi tidak boleh menjalankan query paralel.
  const siap: {
    product: { id: string; name: string; price: number };
    merchant: { id: string; name: string };
    branch: { id: string; name: string };
    qty: number;
  }[] = [];
  for (const b of baris) {
    const p = await tx.merchantProduct.findUnique({
      where: { id: b.productId },
      select: {
        id: true,
        name: true,
        price: true,
        kind: true,
        is_active: true,
        merchant: { select: { id: true, name: true, is_active: true, status: true } },
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
  return { siap, subtotal };
}

/** Rincian tagihan untuk subtotal + metode (dipakai server; tampilan memakai rumus yang sama di lib/payment/biaya). */
export function rincianTagihan(subtotal: number, metode: string) {
  const pf = platformFee(sudahPkp());
  const { total, biaya } = rincianBayar(subtotal + pf.total, metode);
  return { subtotal, bea: pf.total, biaya_bayar: biaya, total };
}

/**
 * Buat pesanan "menunggu" + sesi DOKU Checkout untuk metode terpilih.
 * Mode demo (tanpa DOKU, ENABLE_TOPUP_DEMO=true): langsung dianggap lunas.
 */
export async function mulaiBelanja(
  user: { id: string; name: string; email: string },
  baris: BarisBelanja[],
  kodeMetode: string,
  siteUrl: string,
): Promise<{ url: string; invoice: string }> {
  const mode = isiPundiTersedia();
  if (!mode) throw new Error("Pembayaran belum tersedia.");
  const metode = cariMetode(kodeMetode);
  const menunggu = await prisma.order.count({
    where: { user_id: user.id, status: "menunggu", created_at: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (menunggu >= MAKS_MENUNGGU_PER_JAM) throw new Error("Masih ada pembayaran yang menunggu. Selesaikan dulu atau tunggu 1 jam.");

  const { siap, subtotal } = await prisma.$transaction((tx) => siapkanBelanja(tx, baris));
  const t = rincianTagihan(subtotal, metode.kode);
  const invoice = invoiceBaru("KD-BLJ");
  const jumlah = siap.reduce((s, x) => s + x.qty, 0);
  const order = await prisma.order.create({
    data: {
      user_id: user.id,
      ...t,
      invoice_number: invoice,
      metode: metode.kode,
      provider: mode === "demo" ? "demo" : doku()!.nama,
      expires_at: new Date(Date.now() + MENIT_BAYAR * 60_000),
      items: {
        create: siap.map((x) => ({
          product_id: x.product.id,
          merchant_id: x.merchant.id,
          branch_id: x.branch.id,
          name: x.product.name,
          unit_price: x.product.price,
          qty: x.qty,
        })),
      },
    },
  });
  const kembali = `/bayar/selesai?inv=${encodeURIComponent(invoice)}`;

  if (mode === "demo") {
    await lunasiBelanja(invoice, t.total, null);
    return { url: kembali, invoice };
  }
  const sesi = await doku()!.buatCheckout({
    invoice,
    amount: t.total,
    itemName: `E-voucher Kongsi (${jumlah})`,
    customer: { id: user.id, name: user.name || user.email, email: user.email },
    callbackUrl: `${siteUrl.replace(/\/$/, "")}${kembali}`,
    dueMinutes: MENIT_BAYAR,
    metode: metode.kode,
    lineItems: [
      ...siap.map((x) => ({ name: `${x.product.name} · ${x.branch.name}`, price: x.product.price, quantity: x.qty })),
      { name: "Platform fee Kongsi", price: t.bea, quantity: 1 },
      { name: `Biaya pembayaran ${metode.nama}`, price: t.biaya_bayar, quantity: 1 },
    ],
  });
  await prisma.order.update({ where: { id: order.id }, data: { payment_url: sesi.url, expires_at: sesi.expiresAt } });
  return { url: sesi.url, invoice };
}

/**
 * Pembayaran belanja sukses (notifikasi DOKU / cek status). Idempoten: status diubah atomik → lunas,
 * notifikasi ganda tidak menerbitkan voucher dua kali. Nominal wajib sama dengan tagihan.
 * Harga mengikuti snapshot saat pesanan dibuat (pembeli sudah membayar harga itu).
 */
export async function lunasiBelanja(invoice: string, amount: number, channel: string | null): Promise<"lunas" | "sudah" | "tolak"> {
  return prisma.$transaction(
    async (tx) => {
      const o = await tx.order.findUnique({
        where: { invoice_number: invoice },
        include: {
          items: {
            include: {
              merchant: { select: { name: true } },
              branch: { select: { name: true } },
              product: { select: { valid_days: true } },
            },
          },
        },
      });
      if (!o) return "tolak";
      if (o.status === "lunas") return "sudah";
      if (Math.round(amount) !== o.total) return "tolak";
      const res = await tx.order.updateMany({
        where: { id: o.id, status: { in: ["menunggu", "gagal", "kedaluwarsa"] } },
        data: { status: "lunas", paid_at: new Date(), channel },
      });
      if (res.count !== 1) return "sudah";

      const now = Date.now();
      let jumlahVoucher = 0;
      for (const it of o.items) {
        const hari = it.product?.valid_days ?? 90;
        for (let i = 0; i < it.qty; i++) {
          await tx.voucher.create({
            data: {
              user_id: o.user_id,
              title: it.name,
              note: `${it.merchant?.name ?? "Lapak"}${it.branch ? ` · ${it.branch.name}` : ""}`,
              kind: "evoucher",
              code: await kodeUnik(tx),
              merchant_id: it.merchant_id,
              product_id: it.product_id,
              branch_id: it.branch_id,
              order_item_id: it.id,
              expires_at: new Date(now + hari * 24 * 3600_000),
            },
          });
          jumlahVoucher++;
        }
        if (it.merchant_id) await tx.merchant.update({ where: { id: it.merchant_id }, data: { tebusan_count: { increment: it.qty } } });
      }

      // Level naik berdasar akumulasi belanja (harga voucher). Cap tetap dikumpulkan (hadiahnya menyusul).
      const prof = await tx.profile.upsert({ where: { id: o.user_id }, create: { id: o.user_id }, update: {} });
      const totalSpend = prof.total_spend + o.subtotal;
      await tx.profile.update({
        where: { id: o.user_id },
        data: { total_spend: totalSpend, stamps: prof.stamps + 1, level: levelFor(totalSpend) },
      });
      await beriKabar(tx, o.user_id, {
        kind: "voucher",
        title: `${jumlahVoucher} Surat Jalan terbit`,
        body: "Tunjukkan kodenya ke petugas di cabang yang kamu pilih.",
        href: "/pakhuis#surat-jalan",
      });
      return "lunas";
    },
    { timeout: 20_000 },
  );
}

export async function gagalkanBelanja(invoice: string, status: "gagal" | "kedaluwarsa") {
  await prisma.order.updateMany({ where: { invoice_number: invoice, status: "menunggu" }, data: { status } });
}

/** Cocokkan pesanan milik user dengan status di DOKU (bila notifikasi terlambat). */
export async function rekonsiliasiBelanja(userId: string, invoice: string) {
  const o = await prisma.order.findFirst({ where: { invoice_number: invoice, user_id: userId } });
  if (!o) return null;
  if (o.status === "menunggu") {
    const drv = doku();
    if (drv && drv.nama === o.provider) {
      const st = await drv.cekStatus(invoice).catch(() => null);
      if (st?.status === "SUCCESS" && st.amount != null) await lunasiBelanja(invoice, st.amount, st.channel);
      else if (st?.status === "FAILED" || st?.status === "EXPIRED") await gagalkanBelanja(invoice, st.status === "FAILED" ? "gagal" : "kedaluwarsa");
      else if (o.expires_at && o.expires_at < new Date()) await gagalkanBelanja(invoice, "kedaluwarsa");
    }
  }
  return prisma.order.findUnique({
    where: { id: o.id },
    select: { invoice_number: true, status: true, subtotal: true, bea: true, biaya_bayar: true, total: true, metode: true },
  });
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
