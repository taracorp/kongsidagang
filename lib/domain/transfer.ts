import "server-only";
import { prisma } from "@/lib/db";
import { namaBank } from "@/lib/data/bank";
import { beriKabar } from "@/lib/domain/kabar-user";
import type { Tx } from "@/lib/domain/pundi";

// Transfer keluar (Ch 8.35): satu-satunya jalan uang keluar dari Kongsi ke rekening user/lapak.
// - Hanya dari dana yang SUDAH diterima untuk transaksi itu (selisih rekber, titipan lapak, klaim asuransi cair).
// - Biaya transfer sudah ditagih dari pihak yang tepat sebelum masuk antrian (kolom `biaya`, untuk catatan).
// - Pengurus mentransfer manual lalu menandai "dibayar" dengan nomor referensi; rekening penerima disalin saat itu.

export type JenisTransfer = "pencairan_selisih" | "refund_selisih" | "setoran_lapak" | "refund_belanja" | "klaim_asuransi";

export const LABEL_TRANSFER: Record<JenisTransfer, string> = {
  pencairan_selisih: "Pencairan selisih tukar",
  refund_selisih: "Pengembalian selisih tukar",
  setoran_lapak: "Setoran lapak",
  refund_belanja: "Pengembalian belanja",
  klaim_asuransi: "Klaim asuransi kurir",
};

export async function antrikanTransfer(
  tx: Tx,
  t: {
    jenis: JenisTransfer;
    userId: string;
    nominal: number;
    biaya: number;
    dealId?: string | null;
    ref?: string | null;
    keterangan: string;
    tenggat: Date;
  },
): Promise<string | null> {
  const nominal = Math.round(t.nominal);
  if (nominal <= 0) return null;
  const row = await tx.transferKeluar.create({
    data: {
      jenis: t.jenis,
      user_id: t.userId,
      nominal,
      biaya: Math.max(0, Math.round(t.biaya)),
      deal_id: t.dealId ?? null,
      ref: t.ref ?? null,
      keterangan: t.keterangan.slice(0, 300),
      tenggat: t.tenggat,
    },
  });
  const rek = await tx.rekeningUser.findUnique({ where: { user_id: t.userId }, select: { user_id: true } });
  await beriKabar(tx, t.userId, {
    kind: "pundi",
    title: `${LABEL_TRANSFER[t.jenis]}: Rp ${nominal.toLocaleString("id-ID")}`,
    body: `${t.keterangan} Ditransfer paling lambat ${t.tenggat.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" })}.${
      rek ? "" : " Isi rekening pencairan di Pakhuis agar bisa ditransfer."
    }`,
    href: "/pakhuis#transfer",
  });
  return row.id;
}

/** Pengurus menandai transfer sudah dibayar. Rekening penerima terbaru disalin ke catatan. */
export async function tandaiDibayar(adminId: string, id: string, referensi: string) {
  const ref = String(referensi ?? "").trim().slice(0, 80);
  if (ref.length < 3) throw new Error("Tulis nomor referensi transfer bank.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM transfer_keluar WHERE id = ${id} FOR UPDATE`;
    const t = await tx.transferKeluar.findUnique({ where: { id } });
    if (!t) throw new Error("Transfer tidak ditemukan.");
    if (t.status !== "antri") throw new Error(`Transfer berstatus ${t.status}.`);
    if (t.user_id === adminId) throw new Error("Tidak boleh menandai transfer untuk dirimu sendiri — minta pengurus lain.");
    const rek = await tx.rekeningUser.findUnique({ where: { user_id: t.user_id } });
    if (!rek) throw new Error("Penerima belum mengisi rekening pencairan.");
    await tx.transferKeluar.update({
      where: { id },
      data: {
        status: "dibayar",
        bank: rek.bank,
        nomor: rek.nomor,
        atas_nama: rek.atas_nama,
        referensi: ref,
        dibayar_at: new Date(),
        dibayar_oleh: adminId,
      },
    });
    await beriKabar(tx, t.user_id, {
      kind: "pundi",
      title: `Uang ditransfer: Rp ${t.nominal.toLocaleString("id-ID")}`,
      body: `${LABEL_TRANSFER[t.jenis as JenisTransfer] ?? t.jenis} ke ${namaBank(rek.bank)} ••••${rek.nomor.slice(-4)} (ref ${ref}).`,
      href: "/pakhuis#transfer",
    });
  });
}

export type BarisTransfer = {
  id: string;
  jenis: string;
  nominal: number;
  biaya: number;
  keterangan: string;
  status: string;
  tenggat: string;
  lewatTenggat: boolean;
  dealId: string | null;
  referensi: string | null;
  dibayarAt: string | null;
  penerima: { id: string; name: string; email: string };
  rekening: { bank: string; nomor: string; atas_nama: string } | null;
};

/** Antrian (urut tenggat) + riwayat terbaru untuk /admin/transfer. */
export async function daftarTransferAdmin(): Promise<{ antri: BarisTransfer[]; riwayat: BarisTransfer[] }> {
  const [antri, riwayat] = await Promise.all([
    prisma.transferKeluar.findMany({ where: { status: "antri" }, orderBy: { tenggat: "asc" }, take: 200 }),
    prisma.transferKeluar.findMany({ where: { status: { not: "antri" } }, orderBy: { dibayar_at: "desc" }, take: 30 }),
  ]);
  const ids = [...new Set([...antri, ...riwayat].map((t) => t.user_id))];
  const [users, reks] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }),
    prisma.rekeningUser.findMany({ where: { user_id: { in: ids } } }),
  ]);
  const sekarang = Date.now();
  const ke = (t: (typeof antri)[number]): BarisTransfer => {
    const u = users.find((x) => x.id === t.user_id);
    const r = reks.find((x) => x.user_id === t.user_id);
    return {
      id: t.id,
      jenis: t.jenis,
      nominal: t.nominal,
      biaya: t.biaya,
      keterangan: t.keterangan,
      status: t.status,
      tenggat: t.tenggat.toISOString(),
      lewatTenggat: t.status === "antri" && t.tenggat.getTime() < sekarang,
      dealId: t.deal_id,
      referensi: t.referensi,
      dibayarAt: t.dibayar_at?.toISOString() ?? null,
      penerima: { id: t.user_id, name: u?.name || "(akun dihapus)", email: u?.email ?? "" },
      // Yang sudah dibayar menampilkan salinan saat dibayar; yang antri menampilkan rekening terbaru.
      rekening:
        t.status === "antri"
          ? r
            ? { bank: r.bank, nomor: r.nomor, atas_nama: r.atas_nama }
            : null
          : t.bank
            ? { bank: t.bank, nomor: t.nomor ?? "", atas_nama: t.atas_nama ?? "" }
            : null,
    };
  };
  return { antri: antri.map(ke), riwayat: riwayat.map(ke) };
}

/** Transfer milik user (Pakhuis). */
export async function transferSaya(userId: string) {
  return prisma.transferKeluar.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take: 20,
    select: { id: true, jenis: true, nominal: true, status: true, tenggat: true, keterangan: true, referensi: true, dibayar_at: true },
  });
}
