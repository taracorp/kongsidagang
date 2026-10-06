// Uji belanja e-voucher + validasi petugas (DB kongsi_dev, data tenant asli):
//   npx tsx --conditions=react-server scripts/uji/belanja.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.ENABLE_TOPUP_DEMO = "true";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
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

  try {
    await P.topupDemo(U, "300000");
    ok((await galat(() => B.belanja(U, [{ productId: facial.id, branchId: null, qty: 1 }]))).includes("cabang"), "tanpa cabang ditolak");
    ok((await galat(() => B.belanja(U, [{ productId: facial.id, branchId: "cabang-palsu", qty: 1 }]))).includes("Cabang"), "cabang bukan milik lapak ditolak");
    ok((await galat(() => B.belanja(U, [{ productId: facial.id, branchId: jakal.id, qty: 0 }]))).includes("Jumlah"), "qty 0 ditolak");
    ok((await galat(() => B.belanja(U, [{ productId: facial.id, branchId: jakal.id, qty: 21 }]))).includes("Jumlah"), "qty 21 ditolak");
    ok((await galat(() => B.belanja(U, [{ productId: facial.id, branchId: jakal.id, qty: 3 }]))).includes("tidak cukup"), "saldo kurang (3×125rb+bea) ditolak");
    ok((await bal()) === 300_000, "saldo tetap setelah gagal");
    const prodDs = await prisma.merchantProduct.create({ data: { merchant_id: ds.id, name: "Uji Produk Segera", price: 50_000 } });
    ok((await galat(() => B.belanja(U, [{ productId: prodDs.id, branchId: jakal.id, qty: 1 }]))).includes("belum menerima"), "lapak 'segera hadir' tidak bisa dibeli");
    await prisma.merchantProduct.delete({ where: { id: prodDs.id } });

    // Pembelian sah: 2× Facial Acne (Jakal) + 1× Wash and Dry (Bantul). Harga dari DB.
    const r = await B.belanja(U, [{ productId: facial.id, branchId: jakal.id, qty: 2 }, { productId: hair.id, branchId: bantul.id, qty: 1 }]);
    const subtotal = 2 * facial.price + hair.price;
    ok(r.voucher === 3 && r.total === subtotal + r.bea, `3 voucher terbit, total = harga DB (${subtotal}) + bea ${r.bea}`);
    ok((await bal()) === 300_000 - r.total, "saldo terpotong tepat");
    const v = await prisma.voucher.findMany({ where: { user_id: U }, orderBy: { created_at: "asc" } });
    ok(v.length === 3 && new Set(v.map((x) => x.code)).size === 3 && v.every((x) => /^[2-9A-HJKMNP-Z]{10}$/.test(x.code!)), "kode unik 10 karakter tanpa huruf ambigu");
    ok(v.filter((x) => x.branch_id === jakal.id).length === 2 && v.some((x) => x.branch_id === bantul.id), "voucher terikat cabang yang dipilih");
    ok(v.every((x) => x.expires_at && Math.abs(x.expires_at.getTime() - Date.now() - 90 * 864e5) < 864e5), "berlaku 90 hari");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } });
    ok(order.items.length === 2 && order.subtotal === subtotal, "Order + OrderItem tercatat");
    ok((await prisma.merchant.findUniqueOrThrow({ where: { id: bc.id } })).tebusan_count === tebusAwal + 3, "jumlah tebusan lapak bertambah 3");

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
    const s = (await prisma.walletTransaction.aggregate({ where: { user_id: U }, _sum: { amount: true } }))._sum.amount ?? 0;
    ok(s === (await bal()), "Σ transaksi = saldo");
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [U, S] } } });
    await prisma.merchant.update({ where: { id: bc.id }, data: { tebusan_count: tebusAwal } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
