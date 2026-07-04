import { notFound } from "next/navigation";
import { CompassRose } from "@/components/kongsi/icons";
import { SegelBadge, Pill } from "@/components/kongsi/Pill";
import { Stars } from "@/components/kongsi/PintuCard";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { ProdukCard, type Tone } from "@/components/kongsi/ProdukCard";
import { getMerchant, merchants } from "@/lib/dummy";

export function generateStaticParams() {
  return merchants.map((m) => ({ slug: m.slug }));
}

const toneVar = (t: Tone) => `var(--color-kongsi-${t})`;

export default async function LojiDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loji = getMerchant(slug);
  if (!loji) notFound();

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] overflow-hidden rounded-[6px] border-2 border-kongsi-ink shadow-hard-lg">
          <div
            className="h-[130px]"
            style={{
              background: `linear-gradient(120deg, ${toneVar(loji.coverFrom)}, ${toneVar(loji.coverTo)})`,
            }}
          />
          <div className="flex flex-wrap items-center gap-4 bg-kongsi-parchment px-[22px] py-[18px]">
            <div className="-mt-12 flex h-[66px] w-[66px] items-center justify-center rounded-[8px] border-2 border-kongsi-ink bg-kongsi-beeswax text-kongsi-ink">
              <CompassRose size={36} />
            </div>
            <div className="flex-1">
              <h2 className="flex flex-wrap items-center gap-[9px] font-fraunces text-[25px] font-black text-kongsi-indigo">
                {loji.name}
                {loji.sealed ? <SegelBadge label="Saudagar Bersegel" /> : null}
              </h2>
              <div className="text-[13px] text-kongsi-ink-soft">
                {loji.category} · {loji.city} · <Stars rating={loji.rating} /> (
                {loji.tebusan.toLocaleString("id-ID")} tebusan)
              </div>
            </div>
            <KongsiButton variant="gold">Ikuti Loji</KongsiButton>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-fraunces text-[22px] font-black text-kongsi-indigo">
            Barang di lapak
          </h3>
          {loji.status === "obral" && loji.flashSale ? (
            <Pill variant="live">🔥 Obral Kilat {loji.flashSale}</Pill>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loji.products.map((p) => (
            <ProdukCard
              key={p.name}
              name={p.name}
              shop={loji.name}
              price={p.price}
              oldPrice={p.oldPrice}
              tone={p.tone}
              addable
            />
          ))}
        </div>
      </div>
    </section>
  );
}
