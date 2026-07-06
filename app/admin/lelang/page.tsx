import { redirect } from "next/navigation";
import { AuctionStatusSelect } from "@/components/kongsi/AuctionStatusSelect";
import { getAdminData } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { formatKeping } from "@/lib/utils";

export default async function AdminLelang() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const { auctions } = await getAdminData();

  return (
    <div className="space-y-4">
      <div className="rounded-[5px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-[15px] py-[11px] text-[13px] text-kongsi-grenadine-dark">
        ⚠️ <b className="text-kongsi-grenadine">Rahasia:</b> harga deal &amp; set
        hanya tampil untuk pengurus (via RLS). Halaman publik pakai{" "}
        <code>auction_items_public</code>.
      </div>
      <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
              <th className="p-[11px_14px]">Clue</th>
              <th className="p-[11px_14px]">Loji (rahasia)</th>
              <th className="p-[11px_14px]">Normal</th>
              <th className="p-[11px_14px]">Deal</th>
              <th className="p-[11px_14px]">Set</th>
              <th className="p-[11px_14px]">Margin</th>
              <th className="p-[11px_14px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {auctions.map((a) => {
              const margin =
                a.set_price != null && a.deal_price != null
                  ? a.set_price - a.deal_price
                  : null;
              return (
                <tr key={a.id} className="even:bg-kongsi-sage/10">
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    {a.clue_category}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-bold text-kongsi-bad">
                    {a.clue_name_masked}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    {formatKeping(a.normal_price)}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-bold text-kongsi-bad">
                    {a.deal_price != null ? formatKeping(a.deal_price) : "—"}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-bold text-kongsi-bad">
                    {a.set_price != null ? formatKeping(a.set_price) : "—"}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px] font-bold text-kongsi-ok">
                    {margin != null ? formatKeping(margin) : "—"}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]">
                    <AuctionStatusSelect id={a.id} status={a.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-kongsi-ink-soft">
        ◆ Ubah status memicu transisi tirai realtime di halaman{" "}
        <code>/lelang</code> semua penonton.
      </p>
    </div>
  );
}
