import Link from "next/link";
import { cn } from "@/lib/utils";
import { artikel } from "@/lib/data-e";
import type { Tone } from "@/components/kongsi/ProdukCard";

const toneBg: Record<Tone, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

export default function KabarPage() {
  const [big, ...rest] = artikel;

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Kabar Kongsi
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Cerita dari jalur dagang
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={`/kabar/${big.slug}`}
            className="overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard sm:col-span-2 lg:row-span-2"
          >
            <div
              className={cn(
                "flex h-[200px] items-end p-3",
                "bg-gradient-to-br from-kongsi-indigo to-kongsi-grenadine",
              )}
            >
              <span className="rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-beeswax px-[9px] py-[3px] text-[11px] font-bold uppercase tracking-[0.6px] text-kongsi-ink">
                Panduan
              </span>
            </div>
            <div className="px-4 py-[14px]">
              <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-grenadine">
                {big.tag}
              </div>
              <h4 className="mt-1 font-fraunces text-2xl font-black leading-[1.15] text-kongsi-indigo">
                {big.title}
              </h4>
              <p className="mt-[6px] text-[12px] text-kongsi-ink-soft">
                {big.excerpt}
              </p>
            </div>
          </Link>

          {rest.map((a) => (
            <Link
              key={a.slug}
              href={`/kabar/${a.slug}`}
              className="overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard"
            >
              <div className={cn("h-[120px]", toneBg[a.tone])} />
              <div className="px-4 py-[14px]">
                <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-grenadine">
                  {a.tag}
                </div>
                <h4 className="mt-1 font-fraunces text-[17px] font-black leading-[1.15] text-kongsi-indigo">
                  {a.title}
                </h4>
                <p className="mt-[6px] text-[12px] text-kongsi-ink-soft">
                  {a.excerpt}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
