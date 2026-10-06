"use server";

import {
  topupDemo,
  isiPundiTersedia,
  mulaiIsiPundi,
  lunasiIsiPundi,
} from "@/lib/domain/pundi";
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
    return lunasiIsiPundi(o.invoice_number, o.price, "TIRUAN");
  });
}

