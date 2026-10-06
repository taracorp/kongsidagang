// Uji Bayar Langsung (DOKU tiruan + route notifikasi) di kongsi_dev, data tenant asli:
//   npx tsx --conditions=react-server scripts/uji/bayar-langsung.ts
import { config } from "dotenv";
config({ path: ".env.local" });
process.env.DOKU_MOCK = "true";
process.env.DOKU_CLIENT_ID = "BRN-UJI-0001";
process.env.DOKU_SECRET_KEY = "SK-rahasia-uji";

async function main() {
  const { prisma } = await import("@/lib/db");
  const P = await import("@/lib/domain/pundi");
  const L = await import("@/lib/domain/bayar-langsung");
  const D = await import("@/lib/payment/doku");
  const { hitungSelisih } = await import("@/lib/domain/tukar-aturan");
  const { POST } = await import("@/app/api/doku/notifikasi/route");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

  const U = "uji-langsung-a", V = "uji-langsung-b";
  const ids = [U, V];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const akun = (id: string) => ({ id, name: id, email: `${id}@uji.local` });
  const bal = async (id: string) => (await prisma.wallet.findUnique({ where: { user_id: id } }))?.balance ?? 0;
  const setSaldo = async (id: string, n: number) => {
    const b = await bal(id);
    await prisma.$transaction((tx) => (n > b ? P.credit(tx, id, n - b, "isi", "uji") : P.debit(tx, id, b - n, "isi", "uji")));
  };
  const order = (inv: string) => prisma.topupOrder.findUniqueOrThrow({ where: { invoice_number: inv } });
  async function notif(inv: string, amount: number) {
    const raw = JSON.stringify({ order: { invoice_number: inv, amount }, transaction: { status: "SUCCESS" }, channel: { id: "QRIS" } });
    const h = { clientId: "BRN-UJI-0001", requestId: crypto.randomUUID(), timestamp: D.stempelWaktu(), target: D.PATH_NOTIFIKASI };
    const res = await POST(new Request("http://x" + D.PATH_NOTIFIKASI, {
      method: "POST",
      headers: { "client-id": h.clientId, "request-id": h.requestId, "request-timestamp": h.timestamp, signature: D.tandaTangan("SK-rahasia-uji", h, raw) },
      body: raw,
    }));
    return res.status;
  }
  const SITE = "https://kongsidagang.store";

  const bc = await prisma.merchant.findUniqueOrThrow({ where: { slug: "beauty-center-drw-skincare" }, include: { branches: { orderBy: { sort: "asc" } } } });
  const tebusAwal = bc.tebusan_count;
  const facial = await prisma.merchantProduct.findFirstOrThrow({ where: { merchant_id: bc.id, name: "Facial Acne" } });
  const hair = await prisma.merchantProduct.findFirstOrThrow({ where: { merchant_id: bc.id, name: "Wash and Dry" } });
  const cabang = bc.branches[0].id;
  const keranjang = (p: { id: string }) => ({ baris: [{ productId: p.id, branchId: cabang, qty: 1 }] });
  const items: string[] = [];

  try {
    // --- Belanja, saldo 0, bayar penuh
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "belanja", { baris: [{ productId: facial.id, branchId: null, qty: 1 }] }, "penuh", SITE))).includes("cabang"),
      "input tidak sah ditolak SEBELUM user membayar");
    ok((await prisma.topupOrder.count({ where: { user_id: U } })) === 0, "tidak ada tagihan dibuat untuk input tidak sah");
    const a = await L.mulaiBayarLangsung(akun(U), "belanja", keranjang(facial), "penuh", SITE);
    let o = await order(a.invoice);
    ok(o.price === facial.price + 2000 && o.keteng === o.price && o.tujuan === "belanja" && o.tujuan_status === "menunggu",
      `tagihan = harga DB + bea (${o.price}), tujuan menunggu`);
    ok((await bal(U)) === 0 && (await prisma.voucher.count({ where: { user_id: U } })) === 0, "belum ada Keteng/voucher sebelum lunas");
    ok((await notif(a.invoice, o.price)) === 200, "notifikasi DOKU diterima");
    o = await order(a.invoice);
    const v1 = await prisma.voucher.count({ where: { user_id: U } });
    ok(o.status === "paid" && o.tujuan_status === "berhasil" && !!o.tujuan_ref, "lunas → tujuan berhasil (ref order)");
    ok(v1 === 1 && (await bal(U)) === 0, "1 Surat Jalan terbit, Keteng langsung terpakai (saldo 0)");
    await notif(a.invoice, o.price);
    await L.jalankanTujuan(a.invoice);
    ok((await prisma.voucher.count({ where: { user_id: U } })) === 1 && (await bal(U)) === 0, "notifikasi ganda → tidak dobel");
    const riwayat = await prisma.walletTransaction.findMany({ where: { user_id: U }, orderBy: { created_at: "asc" } });
    ok(riwayat.some((t) => t.note?.startsWith("Bayar langsung")) && riwayat.some((t) => t.kind === "belanja"), "riwayat: Bayar langsung + Belanja");

    // --- Saldo sebagian
    await setSaldo(U, 100_000);
    const b = await L.mulaiBayarLangsung(akun(U), "belanja", keranjang(facial), "kurang", SITE);
    ok((await order(b.invoice)).price === 27_000, "pakai saldo 100rb → bayar kekurangan 27rb");
    const b2 = await L.mulaiBayarLangsung(akun(U), "belanja", keranjang(facial), "penuh", SITE);
    ok((await order(b2.invoice)).price === 127_000, "bayar penuh 127rb (saldo tidak dipakai)");
    await prisma.topupOrder.deleteMany({ where: { invoice_number: { in: [b.invoice, b2.invoice] } } });
    await setSaldo(U, 120_000);
    const c = await L.mulaiBayarLangsung(akun(U), "belanja", keranjang(facial), "kurang", SITE);
    ok((await order(c.invoice)).price === 10_000, "kekurangan 7rb → minimal Rp10.000");
    await notif(c.invoice, 10_000);
    ok((await bal(U)) === 3_000 && (await prisma.voucher.count({ where: { user_id: U } })) === 2, "sisa pembulatan 3.000 Keteng tetap di Pundi");
    await setSaldo(U, 200_000);
    ok((await galat(() => L.mulaiBayarLangsung(akun(U), "belanja", keranjang(facial), "kurang", SITE))).includes("sudah cukup"),
      "saldo cukup + 'kurang' → disuruh bayar pakai Keteng");

    // --- Harga berubah sebelum lunas → tujuan gagal, Keteng aman
    await setSaldo(U, 0);
    const d = await L.mulaiBayarLangsung(akun(U), "belanja", keranjang(hair), "penuh", SITE);
    const harga = (await order(d.invoice)).price;
    await prisma.merchantProduct.update({ where: { id: hair.id }, data: { price: 40_000 } });
    await notif(d.invoice, harga);
    await prisma.merchantProduct.update({ where: { id: hair.id }, data: { price: hair.price } });
    o = await order(d.invoice);
    ok(o.tujuan_status === "gagal" && /Total berubah/.test(o.tujuan_hasil ?? ""), `harga naik → tujuan gagal (${o.tujuan_hasil})`);
    ok((await bal(U)) === harga && (await prisma.voucher.count({ where: { user_id: U } })) === 2, "Keteng yang dibayar tetap di Pundi, tidak ada voucher");
    ok((await prisma.notification.count({ where: { user_id: U, title: { startsWith: "Pembayaran masuk" } } })) === 1, "kabar lonceng: pembayaran masuk + alasan");

    // --- Tukar: ajukan (A menambah Keteng) lalu terima COD, keduanya via bayar langsung
    await setSaldo(U, 0);
    const iA = await prisma.barterItem.create({ data: { user_id: U, title: "Uji A", est_value: 100_000, status: "aktif" } });
    const iB = await prisma.barterItem.create({ data: { user_id: V, title: "Uji B", est_value: 300_000, status: "aktif" } });
    items.push(iA.id, iB.id);
    const sel = hitungSelisih(100_000, 300_000);
    const muatanAjukan = { myItemId: iA.id, targetId: iB.id, topup: sel.diff, mode: "cod", addressId: null };
    const e = await L.mulaiBayarLangsung(akun(U), "tukar_ajukan", muatanAjukan, "penuh", SITE);
    const pe = (await order(e.invoice)).price;
    ok(pe === 10_000 + sel.diff, `ajukan: tagihan = bea 10rb + tambah ${sel.diff}`);
    await notif(e.invoice, pe);
    o = await order(e.invoice);
    const deal = o.tujuan_ref ? await prisma.barterDeal.findUnique({ where: { id: o.tujuan_ref } }) : null;
    ok(o.tujuan_status === "berhasil" && deal?.status === "proposed" && (await bal(U)) === 0, "ajukan otomatis setelah lunas; Keteng ditahan rekber");
    ok((await galat(() => L.mulaiBayarLangsung(akun(V), "tukar_terima", { dealId: deal!.id, meetType: "minimarket", meetPlace: "ab" }, "penuh", SITE))) !== "",
      "terima: Titik Aman tidak sah ditolak sebelum bayar");
    const f = await L.mulaiBayarLangsung(akun(V), "tukar_terima", { dealId: deal!.id, meetType: "minimarket", meetPlace: "Indomaret Kaliurang" }, "penuh", SITE);
    const pf = (await order(f.invoice)).price;
    ok(pf === 10_000, "terima: tagihan = bea 10rb");
    await notif(f.invoice, pf);
    ok((await prisma.barterDeal.findUniqueOrThrow({ where: { id: deal!.id } })).status === "agreed", "terima otomatis setelah lunas → deal disepakati");

    for (const id of ids) {
      const s = (await prisma.walletTransaction.aggregate({ where: { user_id: id }, _sum: { amount: true } }))._sum.amount ?? 0;
      const ditahan = (await prisma.walletHold.aggregate({ where: { user_id: id, status: "ditahan" }, _sum: { amount: true } }))._sum.amount ?? 0;
      ok(s === (await bal(id)), `${id}: Σ transaksi = saldo (ditahan ${ditahan})`);
    }
  } finally {
    await prisma.barterDeal.deleteMany({ where: { OR: [{ item_a: { in: items } }, { item_b: { in: items } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.merchantProduct.update({ where: { id: hair.id }, data: { price: hair.price } });
    await prisma.merchant.update({ where: { id: bc.id }, data: { tebusan_count: tebusAwal } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
