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
import { lunasiBelanja } from "@/lib/domain/belanja";
import { run, requireUser, type ActionResult } from "./_util";

/**
 * Isi Pundi (Keteng, khusus Tukar Guling): DOKU → kembalikan URL halaman bayar; mode demo → langsung masuk.
 * `pilihan` = nominal rupiah ("1500000"), `metode` = kode DOKU; pembeli menanggung biaya pembayaran.
 */
export async function isiPundi(pilihan: string, metode: string): Promise<ActionResult<{ url?: string }>> {
  return run(async () => {
    const user = await requireUser();
    const mode = isiPundiTersedia();
    if (mode === "doku") {
      const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
      const { url } = await mulaiIsiPundi(
        { id: user.id, name: user.name ?? "", email: user.email },
        String(pilihan),
        String(metode),
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
    const order = await prisma.order.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } });
    if (order) return lunasiBelanja(order.invoice_number!, order.total, "TIRUAN");
    const o = await prisma.topupOrder.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } });
    if (!o) throw new Error("Pesanan tidak ditemukan.");
    const hasil = await lunasiIsiPundi(o.invoice_number, o.price, "TIRUAN");
    await jalankanTujuan(o.invoice_number);
    return hasil;
  });
}

/**
 * Bayar Langsung (Tukar Guling): bayar lewat DOKU tanpa Isi Pundi dulu. Keteng yang dibutuhkan dihitung server
 * dari tujuan + saldo, pembeli menanggung biaya metode; setelah lunas Keteng masuk lalu aksi tujuannya jalan.
 */
export async function bayarLangsung(
  tujuan: Tujuan,
  muatan: unknown,
  cara: CaraBayar,
  metode: string,
): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    const user = await requireUser();
    const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const { url } = await mulaiBayarLangsung(
      { id: user.id, name: user.name ?? "", email: user.email },
      tujuan,
      muatan,
      cara === "penuh" ? "penuh" : "kurang",
      String(metode),
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

