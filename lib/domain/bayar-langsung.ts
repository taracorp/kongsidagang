import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { buatPesananBayar, invoiceBaru, isiPundiTersedia, lunasiIsiPundi, type TujuanBayar } from "@/lib/domain/pundi";
import * as Tukar from "@/lib/domain/tukar";
import * as Kirim from "@/lib/domain/tukar-kirim";
import { beriKabar } from "@/lib/domain/kabar-user";
import { nominalLangsung, TOPUP_MAX } from "@/lib/pundi-paket";

// Bayar Langsung (khusus Tukar Guling — Keteng hanya berlaku untuk barter): user membayar lewat DOKU
// tanpa Isi Pundi dulu. Keteng yang dibutuhkan diterbitkan 1:1 (lunasiIsiPundi), pembeli menanggung biaya DOKU
// metode pilihannya, lalu aksi tujuannya dijalankan otomatis (jalankanTujuan).
// Bila tujuan gagal dijalankan (tawaran ditarik, barang tidak tersedia, …) Keteng tetap aman di Pundi.
// Belanja e-voucher TIDAK lewat sini: dibayar uang langsung (lib/domain/belanja.ts).

export type Tujuan = Exclude<TujuanBayar, "isi" | "belanja">;
export type CaraBayar = "kurang" | "penuh";

export type MuatanAjukan = { myItemId: string; targetId: string; topup: number; mode: "cod" | "kirim"; addressId: string | null };
export type MuatanTerima = { dealId: string; meetType?: string; meetPlace?: string; addressId?: string };
export type MuatanOngkir = { dealId: string };
type Muatan = MuatanAjukan | MuatanTerima | MuatanOngkir;

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
      return { dealId: String(o.dealId ?? "") };
  }
}

/** Keteng yang dibutuhkan tujuan, dihitung di server (sekaligus memvalidasi input sebelum user membayar). */
export async function hitungKebutuhan(userId: string, tujuan: Tujuan, m: Muatan): Promise<number> {
  switch (tujuan) {
    case "tukar_ajukan": {
      const a = m as MuatanAjukan;
      return Tukar.hitungAjukan(userId, a.myItemId, a.targetId, a.topup, { mode: a.mode, addressId: a.addressId });
    }
    case "tukar_terima": {
      const t = m as MuatanTerima;
      const tahan = await Tukar.hitungTerima(userId, t.dealId, t);
      return t.addressId ? tahan + (await Kirim.hitungOngkirTerima(userId, t.dealId, t.addressId)) : tahan;
    }
    case "tukar_ongkir":
      return Kirim.hitungBayarOngkir(userId, (m as MuatanOngkir).dealId);
  }
}

const NAMA_TUJUAN: Record<Tujuan, string> = {
  tukar_ajukan: "Ajukan Tukar Guling",
  tukar_terima: "Terima Tukar Guling",
  tukar_ongkir: "Ongkir Tukar Guling",
};

export const TUJUAN: Tujuan[] = ["tukar_ajukan", "tukar_terima", "tukar_ongkir"];

/** Halaman kembali setelah bayar. */
export const tautanHasil = (invoice: string) => `/bayar/selesai?inv=${encodeURIComponent(invoice)}`;

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
  const kebutuhan = await hitungKebutuhan(user.id, tujuan, muatan);
  const w = await prisma.wallet.findUnique({ where: { user_id: user.id }, select: { balance: true } });
  const saldo = w?.balance ?? 0;
  const keteng = nominalLangsung(kebutuhan, saldo, cara === "penuh" ? "penuh" : "kurang");
  if (keteng <= 0) throw new Error("Saldo Keteng sudah cukup — bayar pakai Keteng saja.");
  if (keteng > TOPUP_MAX) throw new Error(`Maksimal Rp ${TOPUP_MAX.toLocaleString("id-ID")} per pembayaran.`);
  const data = { tujuan, muatan: muatan as unknown as Prisma.InputJsonValue };

  if (mode === "demo") {
    // Tanpa DOKU (dev): anggap langsung lunas.
    const invoice = invoiceBaru();
    await prisma.topupOrder.create({
      data: {
        user_id: user.id,
        invoice_number: invoice,
        package_id: "langsung",
        price: keteng,
        keteng,
        provider: "demo",
        expires_at: new Date(Date.now() + 3600_000),
        tujuan_status: "menunggu",
        ...data,
      },
    });
    await lunasiIsiPundi(invoice, keteng, null);
    await jalankanTujuan(invoice);
    return { url: tautanHasil(invoice), invoice };
  }

  return buatPesananBayar(
    user,
    { packageId: "langsung", keteng, metode, itemName: `${keteng.toLocaleString("id-ID")} Keteng — ${NAMA_TUJUAN[tujuan]}` },
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
  if (!o || !TUJUAN.includes(o.tujuan as Tujuan) || o.status !== "paid") return;
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
        const t = m as MuatanOngkir;
        await Kirim.bayarOngkir(o.user_id, t.dealId);
        ref = t.dealId;
        hasil = "Ongkir lunas";
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
    await prisma.topupOrder.update({ where: { id: o.id }, data: { tujuan_status: "gagal", tujuan_hasil: alasan } });
    await beriKabar(prisma, o.user_id, {
      kind: "pundi",
      title: `Pembayaran masuk: +${o.keteng.toLocaleString("id-ID")} Keteng`,
      body: `${NAMA_TUJUAN[tujuan]} belum bisa diproses: ${alasan} Keteng-mu aman di Pundi, silakan coba lagi.`,
      href: tautanHasil(o.invoice_number),
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
      biaya_bayar: true,
      tujuan: true,
      tujuan_status: true,
      tujuan_hasil: true,
      tujuan_ref: true,
    },
  });
}
