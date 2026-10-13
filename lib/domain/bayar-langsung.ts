import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buatPesananBayar, invoiceBaru, isiPundiTersedia, lunasiIsiPundi, type TujuanBayar } from "@/lib/domain/pundi";
import * as Tukar from "@/lib/domain/tukar";
import * as Kirim from "@/lib/domain/tukar-kirim";
import { antrikanTransfer } from "@/lib/domain/transfer";
import { beriKabar } from "@/lib/domain/kabar-user";
import { BIAYA_TRANSFER, HARI_KERJA_PENCAIRAN, tambahHariKerja } from "@/lib/domain/tukar-aturan";
import { ketengDibeli, TOPUP_MAX } from "@/lib/pundi-paket";

// Bayar Langsung (khusus Tukar Guling): user membayar lewat DOKU tanpa Isi Pundi dulu.
// - Keteng jaminan yang kurang diterbitkan 1:1 (lunasiIsiPundi); pembeli menanggung biaya DOKU metode pilihannya.
// - Selisih tukar (v3) ikut di tagihan yang sama sebagai UANG rekber (bukan Keteng), hanya lewat QRIS/VA.
// - Setelah lunas, aksi tujuannya dijalankan otomatis (jalankanTujuan). Bila gagal: Keteng tetap di Pundi, uang
//   selisih dikembalikan ke rekening pembayar (dipotong biaya transfer) lewat transfer keluar.
// Belanja e-voucher TIDAK lewat sini: dibayar uang langsung (lib/domain/belanja.ts).

export type Tujuan = Exclude<TujuanBayar, "isi" | "belanja">;
export type CaraBayar = "kurang" | "penuh";

export type MuatanAjukan = { myItemId: string; targetId: string; topup: number; mode: "cod" | "kirim"; addressId: string | null };
export type MuatanTerima = { dealId: string; meetType?: string; meetPlace?: string; addressId?: string };
export type MuatanDeal = { dealId: string };
type Muatan = MuatanAjukan | MuatanTerima | MuatanDeal;

/** Tujuan yang boleh dibuat tagihan baru. (tukar_ajukan & tukar_ongkir hanya untuk tagihan lama.) */
export const TUJUAN: Tujuan[] = ["tukar_terima", "tukar_setor"];

/** Bersihkan muatan dari browser: hanya field yang dikenal, bertipe benar. */
function rapikan(tujuan: Tujuan, m: unknown): Muatan {
  const o = (m ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === "" ? undefined : String(v));
  switch (tujuan) {
    case "tukar_ajukan":
      return {
        myItemId: String(o.myItemId ?? ""),
        targetId: String(o.targetId ?? ""),
        topup: Number(o.topup) || 0,
        mode: o.mode === "kirim" ? "kirim" : "cod",
        addressId: str(o.addressId) ?? null,
      };
    case "tukar_terima":
      return { dealId: String(o.dealId ?? ""), meetType: str(o.meetType), meetPlace: str(o.meetPlace), addressId: str(o.addressId) };
    case "tukar_ongkir":
    case "tukar_setor":
      return { dealId: String(o.dealId ?? "") };
  }
}

/** Kebutuhan tujuan, dihitung di server (sekaligus memvalidasi input sebelum user membayar). */
export async function hitungKebutuhan(userId: string, tujuan: Tujuan, m: Muatan): Promise<{ keteng: number; uang: number }> {
  switch (tujuan) {
    case "tukar_terima": {
      const t = m as MuatanTerima;
      const ongkir = t.addressId ? await Kirim.kutipanTerima(userId, t.dealId, t.addressId) : null;
      return { keteng: await Tukar.hitungTerima(userId, t.dealId, t, ongkir), uang: 0 };
    }
    case "tukar_setor": {
      const s = await Tukar.hitungSetor(userId, (m as MuatanDeal).dealId);
      return { keteng: s.keteng, uang: s.uang };
    }
    default:
      throw new Error("Tujuan pembayaran ini sudah tidak dipakai.");
  }
}

const NAMA_TUJUAN: Record<Tujuan, string> = {
  tukar_ajukan: "Ajukan Tukar Guling",
  tukar_terima: "Terima Tukar Guling",
  tukar_ongkir: "Ongkir Tukar Guling",
  tukar_setor: "Setor Tukar Guling",
};

/** Halaman kembali setelah bayar. */
export const tautanHasil = (invoice: string) => `/bayar/selesai?inv=${encodeURIComponent(invoice)}`;

/** Identitas aksi (untuk mencegah tagihan ganda): tawaran = barang sendiri + barang incaran, deal = id deal. */
function kunciMuatan(tujuan: Tujuan, m: Muatan | null): string {
  if (!m) return "";
  if (tujuan === "tukar_ajukan") {
    const a = m as MuatanAjukan;
    return `${a.myItemId}>${a.targetId}`;
  }
  return (m as MuatanDeal).dealId ?? "";
}

export async function mulaiBayarLangsung(
  user: { id: string; name: string; email: string },
  tujuan: Tujuan,
  muatanMentah: unknown,
  cara: CaraBayar,
  metode: string,
  siteUrl: string,
): Promise<{ url: string; invoice: string }> {
  const mode = isiPundiTersedia();
  if (!TUJUAN.includes(tujuan)) throw new Error("Tujuan pembayaran tidak dikenal.");
  if (!mode) throw new Error("Pembayaran langsung belum tersedia.");
  const muatan = rapikan(tujuan, muatanMentah);
  const { keteng: kebutuhan, uang } = await hitungKebutuhan(user.id, tujuan, muatan);
  const w = await prisma.wallet.findUnique({ where: { user_id: user.id }, select: { balance: true } });
  const saldo = w?.balance ?? 0;
  const keteng = ketengDibeli(kebutuhan, saldo, cara === "penuh" ? "penuh" : "kurang", uang);
  if (keteng <= 0 && uang <= 0) throw new Error("Saldo Keteng sudah cukup — bayar pakai Keteng saja.");
  if (keteng + uang > TOPUP_MAX) throw new Error(`Maksimal Rp ${TOPUP_MAX.toLocaleString("id-ID")} per pembayaran.`);
  const data = { tujuan, muatan: muatan as unknown as Prisma.InputJsonValue };

  // Satu tagihan menunggu per aksi: mencegah user membayar dua kali untuk tawaran/deal yang sama.
  const kunci = kunciMuatan(tujuan, muatan);
  const menunggu = await prisma.topupOrder.findMany({
    where: { user_id: user.id, tujuan, status: "pending", expires_at: { gt: new Date() } },
    select: { invoice_number: true, muatan: true, keteng: true, rekber: true, metode: true, payment_url: true },
  });
  const ganda = menunggu.find((o) => kunciMuatan(tujuan, o.muatan as unknown as Muatan) === kunci);
  if (ganda) {
    if (ganda.payment_url && ganda.keteng === keteng && ganda.rekber === uang && ganda.metode === metode) {
      return { url: ganda.payment_url, invoice: ganda.invoice_number };
    }
    throw new Error("Masih ada tagihan yang menunggu dibayar untuk aksi ini. Selesaikan tagihan itu atau tunggu sampai kedaluwarsa.");
  }

  // Setor tukar: tagihan kedaluwarsa sebelum tenggat tukar (bayar lewat tenggat tidak bisa diterapkan).
  let menit: number | undefined;
  if (tujuan === "tukar_setor") {
    const s = await Tukar.hitungSetor(user.id, (muatan as MuatanDeal).dealId);
    if (s.tenggat) {
      menit = Math.floor((s.tenggat.getTime() - Date.now()) / 60_000) - 5;
      if (menit < 10) throw new Error("Waktu pembayaran hampir habis — tidak cukup untuk membuat tagihan baru.");
    }
  }

  if (mode === "demo") {
    // Tanpa DOKU (dev): anggap langsung lunas.
    const invoice = invoiceBaru();
    await prisma.topupOrder.create({
      data: {
        user_id: user.id,
        invoice_number: invoice,
        package_id: "langsung",
        price: keteng + uang,
        keteng,
        rekber: uang,
        provider: "demo",
        expires_at: new Date(Date.now() + 3600_000),
        tujuan_status: "menunggu",
        ...data,
      },
    });
    await lunasiIsiPundi(invoice, keteng + uang, null);
    await jalankanTujuan(invoice);
    return { url: tautanHasil(invoice), invoice };
  }

  const judul = keteng > 0 ? `${keteng.toLocaleString("id-ID")} Keteng jaminan - ${NAMA_TUJUAN[tujuan]}` : NAMA_TUJUAN[tujuan];
  return buatPesananBayar(
    user,
    { packageId: "langsung", keteng, rekber: uang, rekberNama: "Selisih tukar + biaya transfer (ditahan Kongsi)", metode, itemName: judul, menit },
    tautanHasil,
    siteUrl,
    data,
  );
}

/**
 * Jalankan tujuan pesanan yang sudah lunas. Idempoten: diklaim atomik menunggu → diproses,
 * jadi notifikasi DOKU ganda / cek status ulang tidak menjalankannya dua kali.
 */
export async function jalankanTujuan(invoice: string): Promise<void> {
  const o = await prisma.topupOrder.findUnique({ where: { invoice_number: invoice } });
  if (!o || o.tujuan === "isi" || o.tujuan === "belanja" || o.status !== "paid") return;
  const klaim = await prisma.topupOrder.updateMany({
    where: { id: o.id, tujuan_status: "menunggu" },
    data: { tujuan_status: "diproses" },
  });
  if (klaim.count !== 1) return;

  const tujuan = o.tujuan as Tujuan;
  const m = rapikan(tujuan, o.muatan);
  try {
    let ref: string | null = null;
    let hasil = "";
    switch (tujuan) {
      case "tukar_ajukan": {
        // Tagihan lama: sejak v3 mengajukan gratis (Keteng tetap di Pundi).
        const a = m as MuatanAjukan;
        ref = await Tukar.ajukan(o.user_id, a.myItemId, a.targetId, a.topup, { mode: a.mode, addressId: a.addressId });
        hasil = "Tawaran tukar terkirim";
        break;
      }
      case "tukar_terima": {
        const t = m as MuatanTerima;
        if (t.addressId) await Kirim.terimaKirim(o.user_id, t.dealId, t.addressId);
        else await Tukar.terima(o.user_id, t.dealId, { meetType: t.meetType, meetPlace: t.meetPlace });
        ref = t.dealId;
        hasil = "Tawaran tukar diterima";
        break;
      }
      case "tukar_ongkir": {
        const t = m as MuatanDeal;
        await Kirim.bayarOngkir(o.user_id, t.dealId);
        ref = t.dealId;
        hasil = "Ongkir lunas";
        break;
      }
      case "tukar_setor": {
        const t = m as MuatanDeal;
        // Bagian biaya DOKU atas uang selisih (diganti bila penerima selisih ternyata bersalah).
        const porsi = o.keteng + o.rekber > 0 ? Math.round((o.biaya_bayar * o.rekber) / (o.keteng + o.rekber)) : 0;
        const r = await Tukar.setorLunas(o.user_id, t.dealId, { invoice: o.invoice_number, rekber: o.rekber, biayaRekber: porsi });
        if (r.siapKirim) await Kirim.kirimkanPaket(t.dealId).catch((e) => console.error("[tukar] order kurir ditunda:", e));
        ref = t.dealId;
        hasil = o.rekber > 0 ? "Selisih & jaminan lunas" : "Jaminan lunas";
        break;
      }
    }
    await prisma.topupOrder.update({
      where: { id: o.id },
      data: { tujuan_status: "berhasil", tujuan_hasil: hasil, tujuan_ref: ref },
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Terjadi kesalahan.";
    // Saldo kurang di titik ini berarti kebutuhan berubah (mis. ongkir naik) sejak tagihan dibuat.
    const alasan = /saldo keteng tidak cukup/i.test(pesan) ? "Jumlah yang ditahan berubah sejak tagihan dibuat, Keteng belum cukup." : pesan;
    await prisma.$transaction(async (tx) => {
      await tx.topupOrder.update({ where: { id: o.id }, data: { tujuan_status: "gagal", tujuan_hasil: alasan.slice(0, 300) } });
      // Uang selisih tidak bisa dipakai → kembali ke rekening pembayar (dipotong biaya transfer: pembayaran terlambat /
      // aksi tidak lagi berlaku). Keteng bagian tagihan tetap di Pundi.
      if (o.rekber > 0) {
        await antrikanTransfer(tx, {
          jenis: "refund_selisih",
          userId: o.user_id,
          nominal: o.rekber - BIAYA_TRANSFER,
          biaya: BIAYA_TRANSFER,
          dealId: (m as MuatanDeal).dealId ?? null,
          ref: o.invoice_number,
          keterangan: `Selisih tukar tidak bisa diproses (${alasan}). Dikembalikan dipotong biaya transfer.`.slice(0, 300),
          tenggat: tambahHariKerja(new Date(), HARI_KERJA_PENCAIRAN),
        });
      }
      await beriKabar(tx, o.user_id, {
        kind: "pundi",
        title: o.keteng > 0 ? `Pembayaran masuk: +${o.keteng.toLocaleString("id-ID")} Keteng` : "Pembayaran masuk, belum bisa diproses",
        body: `${NAMA_TUJUAN[tujuan]} belum bisa diproses: ${alasan}${o.keteng > 0 ? " Keteng-mu aman di Pundi." : ""}${o.rekber > 0 ? " Uang selisih dikembalikan ke rekeningmu." : ""}`,
        href: tautanHasil(o.invoice_number),
      });
    });
  }
}

/** Status untuk halaman hasil (milik user saja). */
export async function statusPesanan(userId: string, invoice: string) {
  return prisma.topupOrder.findFirst({
    where: { invoice_number: invoice, user_id: userId },
    select: {
      invoice_number: true,
      status: true,
      price: true,
      keteng: true,
      rekber: true,
      biaya_bayar: true,
      tujuan: true,
      tujuan_status: true,
      tujuan_hasil: true,
      tujuan_ref: true,
    },
  });
}
