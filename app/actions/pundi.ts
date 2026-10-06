"use server";

import {
  topupDemo,
  redeemVoucher,
  checkoutKeping,
  isiPundiTersedia,
  mulaiIsiPundi,
  lunasiIsiPundi,
} from "@/lib/domain/pundi";
import { prisma } from "@/lib/db";
import { run, requireUser, type ActionResult } from "./_util";

/** Isi Pundi: DOKU → kembalikan URL halaman bayar; mode demo → langsung masuk. */
export async function isiPundi(packageId: string): Promise<ActionResult<{ url?: string }>> {
  return run(async () => {
    const user = await requireUser();
    const mode = isiPundiTersedia();
    if (mode === "doku") {
      const site = process.env.BETTER_AUTH_URL || "http://localhost:3000";
      const { url } = await mulaiIsiPundi(
        { id: user.id, name: user.name ?? "", email: user.email },
        String(packageId),
        site,
      );
      return { url };
    }
    if (mode === "demo") {
      await topupDemo(user.id, String(packageId));
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

export async function tebusSuratJalan(voucherId: string) {
  return run(async () => {
    const user = await requireUser();
    await redeemVoucher(user.id, voucherId);
  });
}

export async function bayarDenganKeping(subtotal: number, ongkir: number) {
  return run(async () => {
    const user = await requireUser();
    return checkoutKeping(user.id, subtotal, ongkir);
  });
}
