"use server";

import { topupDemo, redeemVoucher, checkoutKeping } from "@/lib/domain/pundi";
import { run, requireUser } from "./_util";

export async function isiPundiDemo() {
  return run(async () => {
    const user = await requireUser();
    return topupDemo(user.id, 100_000);
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
