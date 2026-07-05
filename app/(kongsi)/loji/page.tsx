import { PintuCard } from "@/components/kongsi/PintuCard";
import { Pill } from "@/components/kongsi/Pill";
import { getLojiList } from "@/lib/queries";

export default async function LojiPage() {
  const merchants = await getLojiList();

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Loji Saudagar
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Lorong para saudagar
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-[18px]">
          {merchants.map((m) => (
            <PintuCard
              key={m.slug}
              href={`/loji/${m.slug}`}
              name={m.name}
              category={m.category}
              rating={m.rating}
              tone={m.tone}
              sealed={m.sealed}
              status={
                m.status === "obral" ? (
                  <Pill variant="gold">Obral Kilat</Pill>
                ) : (
                  <Pill variant="sage">Buka</Pill>
                )
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
