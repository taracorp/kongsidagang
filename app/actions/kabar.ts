"use server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jumlahBelumDibaca, tandaiDibaca } from "@/lib/domain/kabar-user";
import { run, requireUser } from "./_util";

/** Ringkasan untuk TopBar: kabar belum dibaca + saldo. Tamu → null. */
export async function ringkasanTopBar(): Promise<{ belum: number; saldo: number } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const [belum, w] = await Promise.all([
    jumlahBelumDibaca(user.id),
    prisma.wallet.findUnique({ where: { user_id: user.id }, select: { balance: true } }),
  ]);
  return { belum, saldo: w?.balance ?? 0 };
}

export async function bacaKabar(id?: string) {
  return run(async () => {
    const user = await requireUser();
    await tandaiDibaca(user.id, id ? String(id) : undefined);
  });
}
