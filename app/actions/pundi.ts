"use server";

import {
  topupDemo,
  isiPundiTersedia,
  mulaiIsiPundi,
  lunasiIsiPundi,
  rekonsiliasiIsiPundi,
} from "@/lib/domain/pundi";
import { jalankanTujuan, mulaiBayarLangsung, statusPesanan, type CaraBayar, type Tujuan } from "@/lib/domain/bayar-langsung";
import { prisma } from "@/lib/db";
import { run, requireUser, type ActionResult } from "./_util";

/**
 * Isi Pundi: DOKU → kembalikan URL halaman bayar; mode demo → langsung masuk.
 * `pilihan` = id paket ("pedagang") atau nominal rupiah ("1500000"); divalidasi di server (rincianIsi).
 */
export async function isiPundi(pilihan: string): Promise<ActionResult<{ url?: string }>> {
  return run(async () => {
    const user = await requireUser();
    const mode = isiPundiTersedia();
    if (mode === "doku") {
      const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
      const { url } = await mulaiIsiPundi(
        { id: user.id, name: user.name ?? "", email: user.email },
        String(pilihan),
        site,
      );
      return { url };
    }
    if (mode === "demo") {
      await topupDemo(user.id, String(pilihan));
      return {};
    }
    throw new Error("Isi Pundi belum tersedia.");
  });
}

/** Halaman bayar tiruan (DOKU_MOCK=true saja): anggap pembayaran sukses. */
export async function bayarTiruan(invoice: string) {
  return run(async () => {
    if (process.env.DOKU_MOCK !== "true") throw new Error("Mode tiruan tidak aktif.");
    const user = await requireUser();
    const o = await prisma.topupOrder.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } });
    if (!o) throw new Error("Pesanan tidak ditemukan.");
    const hasil = await lunasiIsiPundi(o.invoice_number, o.price, "TIRUAN");
    await jalankanTujuan(o.invoice_number);
    return hasil;
  });
}

const TUJUAN: Tujuan[] = ["belanja", "tukar_ajukan", "tukar_terima", "tukar_ongkir"];

/**
 * Bayar Langsung: bayar lewat DOKU tanpa Isi Pundi dulu. Nominal dihitung server dari tujuan + saldo;
 * setelah lunas uangnya jadi Keteng (1:1) lalu aksi tujuannya dijalankan otomatis.
 */
export async function bayarLangsung(tujuan: Tujuan, muatan: unknown, cara: CaraBayar): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    const user = await requireUser();
    if (!TUJUAN.includes(tujuan)) throw new Error("Tujuan pembayaran tidak dikenal.");
    const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const { url } = await mulaiBayarLangsung(
      { id: user.id, name: user.name ?? "", email: user.email },
      tujuan,
      muatan,
      cara === "penuh" ? "penuh" : "kurang",
      site,
    );
    return { url };
  });
}

/** Status Bayar Langsung untuk halaman hasil: cocokkan dengan DOKU bila notifikasi terlambat, lalu jalankan tujuan. */
export async function statusBayarLangsung(invoice: string) {
  return run(async () => {
    const user = await requireUser();
    if (!(await rekonsiliasiIsiPundi(user.id, String(invoice)))) throw new Error("Pembayaran tidak ditemukan.");
    await jalankanTujuan(String(invoice));
    return statusPesanan(user.id, String(invoice));
  });
}

