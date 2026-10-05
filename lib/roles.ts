import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type StaffRole = "pewarta" | "admin" | "ketua";

export type StaffSession = {
  userId: string | null;
  email: string | null;
  name: string;
  role: StaffRole | null;
};

export async function getStaffSession(): Promise<StaffSession> {
  const user = await getSessionUser();
  if (!user) return { userId: null, email: null, name: "", role: null };

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

  return {
    userId: user.id,
    email: user.email,
    name,
    role: (staff?.role as StaffRole | undefined) ?? null,
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
