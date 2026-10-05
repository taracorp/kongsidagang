import "server-only";
import { requireUser } from "@/lib/auth";
import { getStaffSession, isAdminUp, canEditKabar, isKetua } from "@/lib/roles";

export type ActionResult<T = undefined> = { error: string | null; data?: T };

/** Jalankan aksi; error apa pun jadi pesan untuk UI (bukan crash). */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { error: null, data: await fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Terjadi kesalahan." };
  }
}

export { requireUser };

export async function requireAdminUp() {
  const s = await getStaffSession();
  if (!s.userId || !isAdminUp(s.role)) throw new Error("Hanya pengurus Kantor Kongsi.");
  return s;
}

export async function requireKabarEditor() {
  const s = await getStaffSession();
  if (!s.userId || !canEditKabar(s.role)) throw new Error("Hanya Pewarta/Admin.");
  return s;
}

export async function requireKetua() {
  const s = await getStaffSession();
  if (!s.userId || !isKetua(s.role)) throw new Error("Hanya Ketua Kongsi.");
  return s;
}

export function toInt(v: unknown): number {
  const n = Number(String(v ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}
