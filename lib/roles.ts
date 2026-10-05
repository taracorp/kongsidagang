import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type StaffRole = "pewarta" | "admin" | "ketua";

export type StaffSession = {
  userId: string | null;
  email: string | null;
  name: string;
  role: StaffRole | null;
  /** Superadmin: email di SUPERADMIN_EMAILS — selalu Ketua, tak bisa dicabut. */
  isSuper: boolean;
};

export function isSuperadminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function getStaffSession(): Promise<StaffSession> {
  const user = await getSessionUser();
  if (!user) return { userId: null, email: null, name: "", role: null, isSuper: false };

  const [staff, profile] = await Promise.all([
    prisma.staffRole.findUnique({
      where: { user_id: user.id },
      select: { role: true },
    }),
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { full_name: true },
    }),
  ]);

  const name =
    profile?.full_name || user.name || user.email.split("@")[0] || "Pengurus";

  const isSuper = isSuperadminEmail(user.email);
  return {
    userId: user.id,
    email: user.email,
    name,
    role: isSuper ? "ketua" : ((staff?.role as StaffRole | undefined) ?? null),
    isSuper,
  };
}

export function isAdminUp(role: StaffRole | null): boolean {
  return role === "admin" || role === "ketua";
}
export function canEditKabar(role: StaffRole | null): boolean {
  return role === "pewarta" || role === "admin" || role === "ketua";
}
export function isKetua(role: StaffRole | null): boolean {
  return role === "ketua";
}
