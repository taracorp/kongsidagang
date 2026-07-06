import { redirect } from "next/navigation";
import { ApplicationsAdmin } from "@/components/kongsi/ApplicationsAdmin";
import { getAdminData } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";

export default async function AdminSaudagar() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const { applications } = await getAdminData();

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-kongsi-ink-soft">
        Setujui (cap segel) atau tolak pengajuan saudagar baru.
      </p>
      <ApplicationsAdmin items={applications} />
    </div>
  );
}
