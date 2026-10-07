// Uji belanja e-voucher dibayar uang (DOKU tiruan) + validasi petugas (DB kongsi_dev, data tenant asli):
//   npx tsx --conditions=react-server scripts/uji/belanja.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";
process.env.DOKU_CLIENT_ID = "BRN-UJI-0001";
process.env.DOKU_SECRET_KEY = "SK-rahasia-uji";

async function main() {
  const { prisma } = await import("@/lib/db");
  const D = await import("@/lib/payment/doku");
  const { rincianBayar } = await import("@/lib/payment/biaya");
  const { POST } = await import("@/app/api/doku/notifikasi/route");
  const B = await import("@/lib/domain/belanja");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

  const U = "uji-belanja", S = "uji-petugas";
  await prisma.user.deleteMany({ where: { id: { in: [U, S] } } });
  await prisma.user.create({ data: { id: U, name: "Pembeli Uji", email: `${U}@uji.local` } });
  await prisma.user.create({ data: { id: S, name: "Petugas Uji", email: `${S}@uji.local` } });
  const bal = async () => (await prisma.wallet.findUnique({ where: { user_id: U } }))?.balance ?? 0;

  const bc = await prisma.merchant.findUniqueOrThrow({ where: { slug: "beauty-center-drw-skincare" }, include: { branches: { orderBy: { sort: "asc" } } } });
  const ds = await prisma.merchant.findUniqueOrThrow({ where: { slug: "drw-studio" } });
  const tebusAwal = bc.tebusan_count;
  const facial = await prisma.merchantProduct.findFirstOrThrow({ where: { merchant_id: bc.id, name: "Facial Acne" } });
  const hair = await prisma.merchantProduct.findFirstOrThrow({ where: { merchant_id: bc.id, name: "Wash and Dry" } });
  const [jakal, bantul] = [bc.branches[0], bc.branches.find((b) => b.name.includes("Bantul"))!];

  const SITE = "https://kongsidagang.store";
  async function notif(inv: string, amount: number, status = "SUCCESS") {
    const raw = JSON.stringify({ order: { invoice_number: inv, amount }, transaction: { status }, channel: { id: "QRIS" } });
    const h = { clientId: "BRN-UJI-0001", requestId: crypto.randomUUID(), timestamp: D.stempelWaktu(), target: D.PATH_NOTIFIKASI };
    const res = await POST(new Request("http://x" + D.PATH_NOTIFIKASI, {
      method: "POST",
      headers: { "client-id": h.clientId, "request-id": h.requestId, "request-timestamp": h.timestamp, signature: D.tandaTangan("SK-rahasia-uji", h, raw) },
      body: raw,
    }));
    return res.status;
  }
  const akun = { id: U, name: "Pembeli Uji", email: `${U}@uji.local` };
  const mulai = (baris: { productId: string; branchId: string | null; qty: number }[], metode = "QRIS") => B.mulaiBelanja(akun, baris, metode, SITE);

  try {
    ok((await galat(() => mulai([{ productId: facial.id, branchId: null, qty: 1 }]))).includes("cabang"), "tanpa cabang ditolak");
    ok((await galat(() => mulai([{ productId: facial.id, branchId: "cabang-palsu", qty: 1 }]))).includes("Cabang"), "cabang bukan milik lapak ditolak");
    ok((await galat(() => mulai([{ productId: facial.id, branchId: jakal.id, qty: 0 }]))).includes("Jumlah"), "qty 0 ditolak");
    ok((await galat(() => mulai([{ productId: facial.id, branchId: jakal.id, qty: 21 }]))).includes("Jumlah"), "qty 21 ditolak");
    ok((await galat(() => mulai([{ productId: facial.id, branchId: jakal.id, qty: 1 }], "ONLINE_TO_OFFLINE_ALFA"))).includes("metode"), "metode yang dimatikan ditolak");
    const prodDs = await prisma.merchantProduct.create({ data: { merchant_id: ds.id, name: "Uji Produk Segera", price: 50_000 } });
    ok((await galat(() => mulai([{ productId: prodDs.id, branchId: jakal.id, qty: 1 }]))).includes("belum menerima"), "lapak 'segera hadir' tidak bisa dibeli");
    await prisma.merchantProduct.delete({ where: { id: prodDs.id } });
    ok((await prisma.order.count({ where: { user_id: U } })) === 0, "tidak ada pesanan dibuat untuk input tidak sah");

    // Pesanan sah: 2× Facial Acne (Jakal) + 1× Wash and Dry (Bantul), bayar QRIS. Harga dari DB.
    const a = await mulai([{ productId: facial.id, branchId: jakal.id, qty: 2 }, { productId: hair.id, branchId: bantul.id, qty: 1 }]);
    const subtotal = 2 * facial.price + hair.price;
    let o = await prisma.order.findUniqueOrThrow({ where: { invoice_number: a.invoice }, include: { items: true } });
    const harap = rincianBayar(subtotal + 4_000, "QRIS");
    ok(o.status === "menunggu" && o.subtotal === subtotal && o.bea === 4_000 && o.biaya_bayar === harap.biaya && o.total === harap.total,
      `tagihan = voucher ${subtotal} + platform fee 4.000 + biaya QRIS ${harap.biaya} = ${o.total}`);
    ok(o.items.length === 2 && o.metode === "QRIS" && a.url.includes(a.invoice), "OrderItem snapshot + URL bayar (metode QRIS)");
    ok((await prisma.voucher.count({ where: { user_id: U } })) === 0, "belum ada Surat Jalan sebelum lunas");
    ok((await bal()) === 0, "Keteng tidak tersentuh (belanja pakai uang)");
    await notif(a.invoice, o.total - 100);
    ok((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status === "menunggu", "nominal tidak cocok → ditolak");
    ok((await notif(a.invoice, o.total)) === 200, "notifikasi DOKU lunas diterima");
    o = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } });
    const v = await prisma.voucher.findMany({ where: { user_id: U }, orderBy: { created_at: "asc" } });
    ok(o.status === "lunas" && v.length === 3, "lunas → 3 Surat Jalan terbit");
    await notif(a.invoice, o.total);
    ok((await prisma.voucher.count({ where: { user_id: U } })) === 3, "notifikasi ganda → tidak dobel");
    ok((await bal()) === 0, "saldo Keteng tetap 0");
    ok(new Set(v.map((x) => x.code)).size === 3 && v.every((x) => /^[2-9A-HJKMNP-Z]{10}$/.test(x.code!)), "kode unik 10 karakter tanpa huruf ambigu");
    ok(v.filter((x) => x.branch_id === jakal.id).length === 2 && v.some((x) => x.branch_id === bantul.id), "voucher terikat cabang yang dipilih");
    ok(v.every((x) => x.expires_at && Math.abs(x.expires_at.getTime() - Date.now() - 90 * 864e5) < 864e5), "berlaku 90 hari");
    ok((await prisma.merchant.findUniqueOrThrow({ where: { id: bc.id } })).tebusan_count === tebusAwal + 3, "jumlah tebusan lapak bertambah 3");
    const prof = await prisma.profile.findUniqueOrThrow({ where: { id: U } });
    ok(prof.total_spend === subtotal && prof.stamps === 1, "akumulasi belanja = harga voucher, +1 Cap");

    // Gagal / kedaluwarsa
    const b2 = await mulai([{ productId: hair.id, branchId: bantul.id, qty: 1 }], "VIRTUAL_ACCOUNT_BCA");
    const o2 = await prisma.order.findUniqueOrThrow({ where: { invoice_number: b2.invoice } });
    ok(o2.biaya_bayar >= 4_995, `VA BCA: biaya ${o2.biaya_bayar} ≥ Rp4.995`);
    await notif(b2.invoice, o2.total, "EXPIRED");
    ok((await prisma.order.findUniqueOrThrow({ where: { id: o2.id } })).status === "kedaluwarsa" && (await prisma.voucher.count({ where: { user_id: U } })) === 3,
      "kedaluwarsa → tanpa voucher");

    // Validasi petugas
    const vJakal = v.find((x) => x.branch_id === jakal.id)!;
    ok((await galat(() => B.tebusVoucherLapak(S, ds.id, jakal.id, vJakal.code!))).includes("tidak dikenal"), "lapak lain tidak bisa menebus");
    ok((await galat(() => B.tebusVoucherLapak(S, bc.id, bantul.id, vJakal.code!))).includes("hanya berlaku di cabang"), "cabang salah ditolak (sebut cabang yang benar)");
    const h = await B.tebusVoucherLapak(S, bc.id, jakal.id, `${vJakal.code!.slice(0, 5).toLowerCase()}-${vJakal.code!.slice(5)}`);
    ok(h.title === "Facial Acne" && h.cabang === jakal.name, "petugas cabang Jakal menebus (kode huruf kecil + strip diterima)");
    ok((await galat(() => B.tebusVoucherLapak(S, bc.id, jakal.id, vJakal.code!))).includes("sudah ditebus"), "tidak bisa ditebus dua kali");
    const kedua = v.filter((x) => x.branch_id === jakal.id)[1];
    await prisma.voucher.update({ where: { id: kedua.id }, data: { expires_at: new Date(Date.now() - 1000) } });
    ok((await galat(() => B.tebusVoucherLapak(S, bc.id, jakal.id, kedua.code!))).includes("kedaluwarsa"), "voucher kedaluwarsa ditolak");
    ok((await prisma.voucher.findUniqueOrThrow({ where: { id: kedua.id } })).status === "kadaluarsa", "status jadi kadaluarsa");

    // Voucher lelang ditebus admin
    const lel = await prisma.voucher.create({ data: { user_id: U, title: "Uji hadiah lelang", kind: "lelang", code: B.buatKodeVoucher() } });
    ok((await galat(() => B.tebusVoucherLapak(S, bc.id, jakal.id, lel.code!))).includes("tidak dikenal"), "voucher lelang tidak bisa ditebus lapak");
    ok((await B.tebusVoucherAdmin(S, lel.code!)).title === "Uji hadiah lelang", "voucher lelang ditebus admin");

    const kabar = await prisma.notification.findMany({ where: { user_id: U } });
    ok(kabar.some((k) => k.title.includes("Surat Jalan terbit")) && kabar.filter((k) => k.title.startsWith("Voucher ditebus")).length === 2, `notifikasi tercatat (${kabar.length})`);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [U, S] } } });
    await prisma.merchant.update({ where: { id: bc.id }, data: { tebusan_count: tebusAwal } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
