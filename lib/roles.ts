import { createClient } from "@/lib/supabase/server";

export type StaffRole = "pewarta" | "admin" | "ketua";

export type StaffSession = {
  userId: string | null;
  email: string | null;
  name: string;
  role: StaffRole | null;
};

export async function getStaffSession(): Promise<StaffSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { userId: null, email: null, name: "", role: null };

  const { data } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Pengurus";

  return {
    userId: user.id,
    email: user.email ?? null,
    name,
    role: (data?.role as StaffRole | undefined) ?? null,
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
