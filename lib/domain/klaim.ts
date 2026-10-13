import "server-only";
import { prisma } from "@/lib/db";
import { beriKabar } from "@/lib/domain/kabar-user";
import { antrikanTransfer } from "@/lib/domain/transfer";
import { BIAYA_TRANSFER, HARI_KERJA_PENCAIRAN, tambahHariKerja } from "@/lib/domain/tukar-aturan";

// Klaim asuransi kurir (Fase 5, Ch 8.41). Paket Tukar Guling dikirim dengan asuransi KiriminAja (dibayar penerima paket
// bersama ongkir). Paket hilang/rusak → pengurus mengajukan klaim ke KiriminAja dan mencatatnya di sini.
// - Kongsi TIDAK menalangi: uang keluar hanya setelah klaim CAIR, sebesar yang benar-benar diterima, dipotong biaya
//   transfer, ke penerima klaim (default: pemilik barang = pengirim paket; Syahbandar boleh menetapkan pihak lain).
// - Klaim ditolak kurir → tidak ada ganti dari Kongsi (tertulis di aturan & dikabarkan ke kedua pihak).

const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

async function dataPaket(shipmentId: string) {
  const s = await prisma.barterShipment.findUnique({
    where: { id: shipmentId },
    include: { deal: { include: { itemA: { select: { user_id: true, title: true } }, itemB: { select: { user_id: true, title: true } } } } },
  });
  if (!s) throw new Error("Paket tidak ditemukan.");
  const pengirim = s.leg === "a_to_b" ? s.deal.itemA : s.deal.itemB;
  const penerimaPaket = s.leg === "a_to_b" ? s.deal.itemB : s.deal.itemA;
  return { s, pengirim, penerimaPaket, pihak: [s.deal.itemA.user_id, s.deal.itemB.user_id] };
}

/** Catat klaim yang sudah diajukan ke KiriminAja. */
export async function catatKlaim(
  adminId: string,
  i: { shipmentId: string; nomorKlaim: string; jenis: "hilang" | "rusak"; penerima?: "pengirim" | "penerima"; catatan?: string },
) {
  const nomor = String(i.nomorKlaim ?? "").trim().slice(0, 60);
  if (nomor.length < 3) throw new Error("Isi nomor klaim KiriminAja.");
  if (i.jenis !== "hilang" && i.jenis !== "rusak") throw new Error("Pilih jenis klaim.");
  const { s, pengirim, penerimaPaket, pihak } = await dataPaket(i.shipmentId);
  if (pihak.includes(adminId)) throw new Error("Tidak boleh mengurus klaim tukarmu sendiri — minta pengurus lain.");
  if (!s.order_id || !s.awb) throw new Error("Paket ini belum pernah dibuat di kurir.");
  if (s.insurance <= 0) throw new Error("Paket ini tidak diasuransikan.");
  const penerima = i.penerima === "penerima" ? penerimaPaket : pengirim;
  const ada = await prisma.klaimAsuransi.findUnique({ where: { shipment_id: s.id } });
  if (ada) throw new Error("Klaim untuk paket ini sudah dicatat.");
  const k = await prisma.klaimAsuransi.create({
    data: {
      shipment_id: s.id,
      deal_id: s.deal_id,
      penerima_id: penerima.user_id,
      nomor_klaim: nomor,
      jenis: i.jenis,
      catatan: i.catatan?.trim().slice(0, 300) || null,
      dibuat_oleh: adminId,
    },
  });
  for (const uid of pihak) {
    await beriKabar(prisma, uid, {
      kind: "tukar",
      title: `Klaim asuransi paket ${pengirim.title} diajukan`,
      body: `Nomor klaim ${nomor}. Bila cair, ${uid === penerima.user_id ? "kamu" : "pemilik barang"} menerima nominal dari kurir (dipotong biaya transfer). Bila ditolak kurir, tidak ada ganti dari Kongsi.`,
      href: `/tukar/deal/${s.deal_id}`,
    });
  }
  return k;
}

/** Klaim cair: teruskan nominal yang benar-benar diterima Kongsi dari KiriminAja, dipotong biaya transfer. */
export async function klaimCair(adminId: string, klaimId: string, nominalDiterima: number) {
  if (!Number.isInteger(nominalDiterima) || nominalDiterima <= BIAYA_TRANSFER) throw new Error("Isi nominal yang benar-benar diterima dari kurir.");
  return prisma.$transaction(async (tx) => {
    const k = await tx.klaimAsuransi.findUnique({ where: { id: klaimId } });
    if (!k || k.status !== "diajukan") throw new Error("Klaim sudah diputus.");
    const { pihak, pengirim } = await dataPaket(k.shipment_id);
    if (pihak.includes(adminId)) throw new Error("Tidak boleh mengurus klaim tukarmu sendiri.");
    const r = await tx.klaimAsuransi.updateMany({
      where: { id: k.id, status: "diajukan" },
      data: { status: "cair", nominal_cair: nominalDiterima, diputus_oleh: adminId, diputus_at: new Date() },
    });
    if (r.count !== 1) throw new Error("Klaim sudah diputus.");
    const transferId = await antrikanTransfer(tx, {
      jenis: "klaim_asuransi",
      userId: k.penerima_id,
      nominal: nominalDiterima - BIAYA_TRANSFER,
      biaya: BIAYA_TRANSFER,
      dealId: k.deal_id,
      ref: k.id,
      keterangan: `Klaim asuransi paket ${pengirim.title} (${k.nomor_klaim}) cair ${rp(nominalDiterima)}, dipotong biaya transfer.`,
      tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
    });
    await tx.klaimAsuransi.update({ where: { id: k.id }, data: { transfer_id: transferId } });
  });
}

/** Klaim ditolak kurir → tidak ada ganti dari Kongsi. */
export async function klaimDitolak(adminId: string, klaimId: string, alasan: string) {
  const why = String(alasan ?? "").trim().slice(0, 300);
  if (why.length < 10) throw new Error("Tulis alasan penolakan dari kurir.");
  const k = await prisma.klaimAsuransi.findUnique({ where: { id: klaimId } });
  if (!k || k.status !== "diajukan") throw new Error("Klaim sudah diputus.");
  const { pihak, pengirim } = await dataPaket(k.shipment_id);
  if (pihak.includes(adminId)) throw new Error("Tidak boleh mengurus klaim tukarmu sendiri.");
  const r = await prisma.klaimAsuransi.updateMany({
    where: { id: k.id, status: "diajukan" },
    data: { status: "ditolak", catatan: why, diputus_oleh: adminId, diputus_at: new Date() },
  });
  if (r.count !== 1) throw new Error("Klaim sudah diputus.");
  for (const uid of pihak) {
    await beriKabar(prisma, uid, {
      kind: "tukar",
      title: `Klaim asuransi paket ${pengirim.title} ditolak kurir`,
      body: `${why}. Sesuai aturan, Kongsi tidak mengganti klaim yang ditolak kurir.`,
      href: `/tukar/deal/${k.deal_id}`,
    });
  }
}

/** Daftar untuk Kantor Kongsi: paket bermasalah/diretur yang belum diklaim + klaim yang berjalan. */
export async function daftarKlaimAdmin() {
  const klaim = await prisma.klaimAsuransi.findMany({ orderBy: { created_at: "desc" }, take: 50 });
  const sudah = (await prisma.klaimAsuransi.findMany({ select: { shipment_id: true } })).map((k) => k.shipment_id);
  const calon = await prisma.barterShipment.findMany({
    where: {
      id: { notIn: sudah },
      order_id: { not: null },
      insurance: { gt: 0 },
      OR: [{ status: { in: ["problem", "returned"] } }, { deal: { status: "disputed" }, status: { in: ["shipped", "delivered"] } }],
    },
    select: {
      id: true,
      leg: true,
      awb: true,
      status: true,
      status_text: true,
      item_value: true,
      insurance: true,
      deal_id: true,
      deal: { select: { itemA: { select: { title: true } }, itemB: { select: { title: true } } } },
    },
    take: 50,
  });
  return { calon, klaim };
}
