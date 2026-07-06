import { redirect } from "next/navigation";
import { DisputeResolve } from "@/components/admin/DisputeResolve";
import { getDisputedDeals } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { formatKeping } from "@/lib/utils";

export default async function AdminTukar() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const disputes = await getDisputedDeals();

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-kongsi-ink-soft">
        ⚖️ <b>Syahbandar</b> — adili sengketa Tukar Guling. Sahkan sebagai selesai
        atau batalkan.
      </p>
      {disputes.length === 0 ? (
        <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
          Tidak ada sengketa. Aman terkendali.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
                <th className="p-[11px_14px]">Barang A</th>
                <th className="p-[11px_14px]">Barang B</th>
                <th className="p-[11px_14px]">Tambahan</th>
                <th className="p-[11px_14px]">Putusan</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} className="even:bg-kongsi-sage/10">
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-semibold">
                    {d.itemA}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-semibold">
                    {d.itemB}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    {d.topup > 0 ? formatKeping(d.topup) : "—"}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    <DisputeResolve id={d.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
