import "server-only";
import { prisma } from "@/lib/db";
import { doku } from "@/lib/payment/doku";
import { lunasiIsiPundi } from "@/lib/domain/pundi";
import { lunasiBelanja } from "@/lib/domain/belanja";
import { jalankanTujuan } from "@/lib/domain/bayar-langsung";
import { kabariPengurus } from "@/lib/domain/kabar-user";

// Rekonsiliasi pembayaran DOKU — supaya uang yang sudah masuk tidak pernah "nyangkut" tanpa barang/Keteng:
// - notifikasi DOKU bisa terlambat/hilang, dan VA kadang dibayar setelah pesanan kami tandai kedaluwarsa;
// - cron menanyakan status ke DOKU untuk tagihan belum lunas ≤ 48 jam, lalu memprosesnya bila ternyata lunas;
// - nominal yang tidak cocok TIDAK diproses otomatis: dicatat di `pembayaran_bermasalah` + kabar ke pengurus.

const JENDELA_MS = 48 * 3600_000;
const JEDA_MS = 10 * 60_000; // beri waktu notifikasi DOKU datang dulu
const MAKS_PER_JALAN = 40;

export type JenisBermasalah = "nominal_tidak_cocok" | "tidak_dikenal" | "gagal_proses";

/** Catat sekali per invoice+jenis (selama belum diselesaikan) dan kabari pengurus. */
export async function catatBermasalah(invoice: string, jenis: JenisBermasalah, nominal: number | null, keterangan: string) {
  const ada = await prisma.pembayaranBermasalah.findFirst({ where: { invoice, jenis, selesai_at: null }, select: { id: true } });
  if (ada) return;
  await prisma.pembayaranBermasalah.create({
    data: { invoice, jenis, nominal: Number.isFinite(nominal) ? nominal : null, keterangan: keterangan.slice(0, 500) },
  });
  await kabariPengurus(prisma, {
    kind: "sistem",
    title: `Pembayaran bermasalah: ${invoice}`,
    body: keterangan,
    href: "/admin#pembayaran-bermasalah",
  });
}

/** Pembayaran sukses dari DOKU (notifikasi atau cek status) untuk invoice apa pun. */
export async function prosesLunas(invoice: string, amount: number, channel: string | null): Promise<"lunas" | "sudah" | "tolak"> {
  if (invoice.startsWith("KD-BLJ-")) {
    const hasil = await lunasiBelanja(invoice, amount, channel);
    if (hasil === "tolak") await catatBermasalah(invoice, "nominal_tidak_cocok", amount, `DOKU melaporkan lunas Rp ${amount.toLocaleString("id-ID")}, tetapi pesanan belanja tidak ditemukan atau nominalnya berbeda. Surat Jalan TIDAK diterbitkan.`);
    return hasil;
  }
  const hasil = await lunasiIsiPundi(invoice, amount, channel);
  if (hasil === "tolak") {
    await catatBermasalah(invoice, "nominal_tidak_cocok", amount, `DOKU melaporkan lunas Rp ${amount.toLocaleString("id-ID")}, tetapi tagihan Keteng tidak ditemukan atau nominalnya berbeda. Keteng TIDAK dikreditkan.`);
    return hasil;
  }
  // Bayar Langsung: jalankan aksi tujuannya (idempoten; galat tujuan → Keteng tetap di Pundi + kabar).
  await jalankanTujuan(invoice).catch((e: Error) => catatBermasalah(invoice, "gagal_proses", amount, `Tujuan pembayaran gagal dijalankan: ${e.message}`));
  return hasil;
}

/** Cron: cocokkan tagihan yang belum lunas dengan status DOKU. */
export async function rekonsiliasiPembayaran(now = new Date()): Promise<{ dicek: number; lunas: number }> {
  const drv = doku();
  const hasil = { dicek: 0, lunas: 0 };
  if (!drv) return hasil;
  const sejak = new Date(now.getTime() - JENDELA_MS);
  const sebelum = new Date(now.getTime() - JEDA_MS);
  const [belanja, keteng] = await Promise.all([
    prisma.order.findMany({
      where: { provider: drv.nama, status: { in: ["menunggu", "kedaluwarsa", "gagal"] }, created_at: { gt: sejak, lt: sebelum } },
      select: { invoice_number: true },
      orderBy: { created_at: "desc" },
      take: MAKS_PER_JALAN,
    }),
    prisma.topupOrder.findMany({
      where: { provider: drv.nama, status: { in: ["pending", "expired", "failed"] }, created_at: { gt: sejak, lt: sebelum } },
      select: { invoice_number: true },
      orderBy: { created_at: "desc" },
      take: MAKS_PER_JALAN,
    }),
  ]);
  for (const { invoice_number: inv } of [...belanja, ...keteng]) {
    if (!inv) continue;
    const st = await drv.cekStatus(inv).catch(() => null);
    hasil.dicek++;
    if (st?.status !== "SUCCESS" || st.amount == null) continue;
    if ((await prosesLunas(inv, st.amount, st.channel)) === "lunas") hasil.lunas++;
  }
  // Bayar Langsung yang sudah lunas tetapi aksinya belum sempat dijalankan (proses terputus).
  const tertunda = await prisma.topupOrder.findMany({
    where: { status: "paid", tujuan_status: "menunggu", paid_at: { lt: new Date(now.getTime() - 2 * 60_000), gt: sejak } },
    select: { invoice_number: true },
    take: MAKS_PER_JALAN,
  });
  for (const { invoice_number: inv } of tertunda) await jalankanTujuan(inv).catch(() => {});
  return hasil;
}
