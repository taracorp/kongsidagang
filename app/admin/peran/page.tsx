import { redirect } from "next/navigation";
import { RoleManager } from "@/components/admin/RoleManager";
import { getAllUsersWithRoles } from "@/lib/queries";
import { getStaffSession, isKetua } from "@/lib/roles";

export default async function AdminPeran() {
  const { role, userId } = await getStaffSession();
  if (!isKetua(role)) redirect("/admin");
  const users = await getAllUsersWithRoles();

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-kongsi-ink-soft">
        Atur peran staf Kongsi. Pewarta = redaksi Kabar. Admin = operasional.
        Ketua = superadmin (maks 2).
      </p>
      <RoleManager users={users} meId={userId ?? ""} />
    </div>
  );
}
