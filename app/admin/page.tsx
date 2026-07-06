import { BarChart } from "@/components/admin/BarChart";
import { getAdminOverview } from "@/lib/queries";

export default async function RingkasanPage() {
  const { cards, produkPerLoji, lelangPerStatus } = await getAdminOverview();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-kongsi-olive">
              {c.label}
            </div>
            <div
              className={`mt-1 font-fraunces text-[28px] font-black ${c.accent ?? "text-kongsi-indigo"}`}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
          <h3 className="mb-4 font-fraunces text-lg font-black text-kongsi-indigo">
            Produk per Loji
          </h3>
          <BarChart data={produkPerLoji} color="bg-kongsi-beeswax" />
        </div>
        <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
          <h3 className="mb-4 font-fraunces text-lg font-black text-kongsi-indigo">
            Barang Lelang per Fase
          </h3>
          <BarChart data={lelangPerStatus} color="bg-kongsi-grenadine" />
        </div>
      </div>
    </div>
  );
}
