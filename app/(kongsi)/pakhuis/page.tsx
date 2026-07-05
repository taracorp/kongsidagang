import { redirect } from "next/navigation";
import { CompassRose, WaxSeal } from "@/components/kongsi/icons";
import { Pill } from "@/components/kongsi/Pill";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import { getPakhuis } from "@/lib/queries";
import { cn, formatKeping } from "@/lib/utils";
import { levelTangga, riwayatLelang } from "@/lib/data-e";

const levelOrder = [
  "pelanggan_kecil",
  "pelanggan_besar",
  "tuan_kecil",
  "tuan_besar",
  "juragan",
];

const hasilPill: Record<string, "gold" | "sage" | "indigo"> = {
  Menang: "gold",
  "Top 3": "sage",
  "Belum beruntung": "indigo",
};

export default async function PakhuisPage() {
  const data = await getPakhuis();
  if (!data) redirect("/masuk");

  const levelIndex = Math.max(0, levelOrder.indexOf(data.level));
  const capTotal = 10;
  const capFilled = Math.min(capTotal, data.stamps);
  const levelProgress = Math.round((capFilled / capTotal) * 100);

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
              Pakhuis-ku
            </div>
            <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
              Halo, {data.name}
            </h2>
          </div>
          <LogoutButton />
        </div>

        {/* Pundi */}
        <div className="relative mb-[22px] overflow-hidden rounded-[8px] border-2 border-kongsi-ink bg-kongsi-grenadine p-[22px_24px] text-kongsi-parchment shadow-hard">
          <div className="text-[11px] font-bold uppercase tracking-[2px] opacity-85">
            Pundi · Keping
          </div>
          <div className="mt-[3px] font-fraunces text-[38px] font-black leading-none">
            {data.balance.toLocaleString("id-ID")}{" "}
            <small className="text-[15px] opacity-80">
              keping (= {formatKeping(data.balance)})
            </small>
          </div>
          <KongsiButton variant="gold" className="mt-[14px]">
            Isi Pundi
          </KongsiButton>
          <CompassRose
            size={90}
            className="absolute -bottom-2 -right-2 text-kongsi-parchment opacity-15"
          />
        </div>

        {/* Level */}
        <div className="mb-[22px] rounded-[8px] border-2 border-kongsi-ink bg-kongsi-parchment p-[20px_22px] shadow-hard">
          <div className="mb-[6px] flex items-center gap-3">
            <Pill variant="live">Level</Pill>
            <span className="font-fraunces text-2xl font-black text-kongsi-indigo">
              {levelTangga[levelIndex]}
            </span>
          </div>
          <div className="text-[13px] text-kongsi-ink-soft">
            Naikkan level dengan makin banyak menebus — buka akses Vendu tanpa
            antre &amp; potongan bea.
          </div>
          <div className="my-[10px] h-3 overflow-hidden rounded-full border-2 border-kongsi-ink bg-kongsi-parchment-2">
            <i
              className="block h-full bg-kongsi-beeswax"
              style={{ width: `${levelProgress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-[6px]">
            {levelTangga.map((lv, i) => (
              <span
                key={lv}
                className={cn(
                  "rounded-full border-[1.5px] border-kongsi-ink px-[9px] py-1 text-[11px] font-bold",
                  i < levelIndex && "bg-kongsi-sage text-kongsi-ink",
                  i === levelIndex &&
                    "bg-kongsi-grenadine text-kongsi-parchment",
                  i > levelIndex && "bg-kongsi-parchment-3 text-kongsi-ink-soft",
                )}
              >
                {lv}
              </span>
            ))}
          </div>
          <div className="mt-[14px]">
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">
              Cap terkumpul ({capTotal} = 1 potongan)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: capTotal }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 border-kongsi-ink text-[15px]",
                    i < capFilled
                      ? "bg-kongsi-beeswax"
                      : "bg-kongsi-parchment-2 opacity-60",
                  )}
                >
                  {i < capFilled ? "✓" : "·"}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Surat Jalan */}
        <h3 className="mb-3 font-fraunces text-xl font-black text-kongsi-indigo">
          Surat Jalan (voucher)
        </h3>
        {data.vouchers.length === 0 ? (
          <p className="mb-4 rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada Surat Jalan. Menang lelang atau tebus neraca untuk
            mendapatkannya.
          </p>
        ) : (
          data.vouchers.map((v) => (
            <div
              key={v.title}
              className="mb-[10px] flex items-center gap-[14px] rounded-[6px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-[14px_16px]"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[6px] border-2 border-kongsi-ink bg-kongsi-beeswax">
                <WaxSeal size={24} />
              </span>
              <div className="flex-1">
                <b className="font-fraunces text-[15px] text-kongsi-indigo">
                  {v.title}
                </b>
                <div className="text-[12px] text-kongsi-ink-soft">{v.note}</div>
              </div>
              <Pill variant="gold">Tebus</Pill>
            </div>
          ))
        )}

        {/* Riwayat */}
        <h3 className="mb-3 mt-6 font-fraunces text-xl font-black text-kongsi-indigo">
          Riwayat lelang
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment">
            <thead>
              <tr className="bg-kongsi-indigo text-left font-fraunces text-xs text-kongsi-parchment">
                <th className="p-[11px_13px]">Barang</th>
                <th className="hidden p-[11px_13px] sm:table-cell">Tebakan</th>
                <th className="p-[11px_13px]">Hasil</th>
              </tr>
            </thead>
            <tbody>
              {riwayatLelang.map((r) => (
                <tr key={r.barang} className="text-[13px] even:bg-kongsi-sage/15">
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    {r.barang}
                  </td>
                  <td className="hidden border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px] sm:table-cell">
                    {formatKeping(r.tebakan)}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[11px_13px]">
                    <Pill variant={hasilPill[r.hasil]}>{r.hasil}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

