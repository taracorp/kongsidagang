import "server-only";
import { prisma } from "@/lib/db";
import type { Tx } from "@/lib/domain/pundi";

// Kabar untuk user (lonceng di TopBar → /kabar-saya). Ditulis di dalam transaksi peristiwanya
// supaya kabar hanya ada bila peristiwanya benar-benar terjadi.

export type JenisKabar = "tukar" | "pundi" | "voucher" | "tera" | "lelang" | "sistem";

export type IsiKabar = { kind: JenisKabar; title: string; body?: string | null; href?: string | null };

export async function beriKabar(db: Tx | typeof prisma, userId: string | null | undefined, k: IsiKabar) {
  if (!userId) return;
  await db.notification.create({
    data: {
      user_id: userId,
      kind: k.kind,
      title: k.title.slice(0, 140),
      body: k.body ? k.body.slice(0, 400) : null,
      href: k.href ?? null,
    },
  });
}

export async function jumlahBelumDibaca(userId: string): Promise<number> {
  return prisma.notification.count({ where: { user_id: userId, read_at: null } });
}

export type KabarItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  created_at: string;
};

export async function kabarSaya(userId: string, take = 50): Promise<KabarItem[]> {
  const rows = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    read: !!r.read_at,
    created_at: r.created_at.toISOString(),
  }));
}

/** Tandai dibaca: satu kabar (id) atau semua milik user. */
export async function tandaiDibaca(userId: string, id?: string) {
  await prisma.notification.updateMany({
    where: { user_id: userId, read_at: null, ...(id ? { id } : {}) },
    data: { read_at: new Date() },
  });
}
