import { BayarClient } from "@/components/kongsi/BayarClient";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function BayarPage() {
  const user = await getSessionUser();

  let level = "pelanggan_kecil";
  let stamps = 0;
  let saldo = 0;
  if (user) {
    const [profile, wallet] = await Promise.all([
      prisma.profile.findUnique({ where: { id: user.id }, select: { level: true, stamps: true } }),
      prisma.wallet.findUnique({ where: { user_id: user.id }, select: { balance: true } }),
    ]);
    level = profile?.level ?? "pelanggan_kecil";
    stamps = profile?.stamps ?? 0;
    saldo = wallet?.balance ?? 0;
  }

  return <BayarClient loggedIn={Boolean(user)} level={level} stamps={stamps} saldo={saldo} />;
}
