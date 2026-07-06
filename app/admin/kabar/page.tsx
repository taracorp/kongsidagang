import { redirect } from "next/navigation";
import { KabarForm, KabarAdmin } from "@/components/kongsi/KabarAdmin";
import { getAdminArticles } from "@/lib/queries";
import { getStaffSession, canEditKabar } from "@/lib/roles";

export default async function AdminKabar() {
  const { role } = await getStaffSession();
  if (!canEditKabar(role)) redirect("/admin");
  const articles = await getAdminArticles();

  return (
    <div className="max-w-[720px] space-y-4">
      <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">
        Tulis artikel
      </h3>
      <KabarForm />
      <h3 className="mt-4 font-fraunces text-lg font-black text-kongsi-indigo">
        Semua artikel
      </h3>
      <KabarAdmin items={articles} />
    </div>
  );
}
