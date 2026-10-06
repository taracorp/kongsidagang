import { PintuCard } from "@/components/kongsi/PintuCard";
import { Pill } from "@/components/kongsi/Pill";
import { getLapakList } from "@/lib/queries-lapak";

const statusPill = (s: string) =>
  s === "obral" ? (
    <Pill variant="gold">Obral Kilat</Pill>
  ) : s === "segera" ? (
    <Pill variant="indigo">Segera hadir</Pill>
  ) : s === "tutup" ? (
    <Pill variant="live">Tutup</Pill>
  ) : (
    <Pill variant="sage">Buka</Pill>
  );

export default async function LapakPage() {
  const lapak = await getLapakList();

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Lapak Saudagar</div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">Lorong para saudagar</h2>
          <p className="mt-1 text-[13px] text-kongsi-ink-soft">
            Beli e-voucher perawatan, tebus di cabang pilihanmu dengan kode Surat Jalan.
          </p>
        </div>
        {lapak.length === 0 ? (
          <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-10 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada lapak yang buka.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-[18px]">
            {lapak.map((m) => (
              <PintuCard
                key={m.slug}
                href={`/lapak/${m.slug}`}
                name={m.name}
                category={m.category}
                rating={m.rating}
                tone={m.tone}
                sealed={m.sealed}
                logo={m.logo}
                note={
                  m.status === "segera"
                    ? "Segera hadir"
                    : `${m.jumlahProduk} perawatan · ${m.jumlahCabang} cabang`
                }
                status={statusPill(m.status)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
