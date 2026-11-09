import { redirect } from "next/navigation";
import { PariwaraForm } from "@/components/kongsi/PariwaraForm";
import { getAdSettings, getTvcLelang } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";

export default async function AdminNeraca() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const [ad, tvc] = await Promise.all([getAdSettings(), getTvcLelang()]);

  return (
    <div className="max-w-[560px] space-y-4">
      <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">
        Sekilas Pariwara (iklan Beranda &amp; panggung)
      </h3>
      <PariwaraForm
        initialVideo={ad.video ?? ""}
        initialImage={ad.image ?? ""}
        initialTvc={tvc}
      />
      <p className="text-[12px] text-kongsi-ink-soft">
        ◆ Banding harga bersumber dari <code>merchant_products</code> lapak mitra.
        Sumber feed/scraper menyusul (lihat AGENTS.md Bagian 7).
      </p>
    </div>
  );
}
