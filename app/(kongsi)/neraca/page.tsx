import { SegelBadge, Pill } from "@/components/kongsi/Pill";
import { Stars } from "@/components/kongsi/PintuCard";
import { formatKeping } from "@/lib/utils";
import { neracaRows, neracaProduk, neracaLapak } from "@/lib/data-e";

export default function NeracaPage() {
  const cheapest = neracaRows.find((r) => r.cheapest)?.price ?? 0;

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Neraca Harga · Dacin Kongsi
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Timbang 10 barang terbaik
          </h2>
        </div>

        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-[14px]">
          <div className="flex max-w-[400px] flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-white">
            <input
              defaultValue={neracaProduk}
              className="w-full px-3 py-[10px] text-sm outline-none"
              aria-label="Barang untuk ditimbang"
            />
            <button className="cursor-pointer bg-kongsi-indigo px-4 font-bold text-kongsi-parchment">
              Timbang
            </button>
          </div>
          <div className="text-[13px] text-kongsi-ink-soft">
            Ditimbang dari{" "}
            <b className="text-kongsi-grenadine">{neracaLapak} lapak</b> ·
            diperbarui 2 jam lalu
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment">
            <thead>
              <tr className="bg-kongsi-indigo text-left font-fraunces text-xs text-kongsi-parchment">
                <th className="w-[40px] p-[11px_13px]">#</th>
                <th className="p-[11px_13px]">Loji / Sumber</th>
                <th className="hidden p-[11px_13px] sm:table-cell">Nilai</th>
                <th className="p-[11px_13px]">Harga</th>
                <th className="hidden p-[11px_13px] sm:table-cell">Hemat</th>
                <th className="p-[11px_13px]"></th>
              </tr>
            </thead>
            <tbody>
              {neracaRows.map((r) => (
                <tr key={r.rank} className="text-[13px] even:bg-kongsi-sage/15">
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    <span
                      className={
                        r.cheapest
                          ? "font-fraunces text-[17px] font-black text-kongsi-grenadine"
                          : "font-fraunces text-[17px] font-black text-kongsi-beeswax-dark"
                      }
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {r.loji}
                      {r.sealed ? <SegelBadge /> : null}
                    </span>
                  </td>
                  <td className="hidden border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px] sm:table-cell">
                    <Stars rating={r.rating} />
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    <span
                      className={
                        r.cheapest
                          ? "font-fraunces font-black text-kongsi-ok"
                          : "font-fraunces font-black text-kongsi-indigo"
                      }
                    >
                      {formatKeping(r.price)}
                    </span>
                  </td>
                  <td className="hidden border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px] text-[11px] font-bold text-kongsi-ok sm:table-cell">
                    {r.cheapest ? "termurah" : `+${formatKeping(r.price - cheapest).replace("Rp ", "")}`}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    <Pill variant={r.cheapest ? "gold" : "sage"}>Tebus</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-kongsi-ink-soft">
          ◆ Harga dari lapak mitra &amp; feed resmi. Loji <b>bersegel</b> memberi
          harga langsung — paling tepercaya (bertera).
        </p>
      </div>
    </section>
  );
}
