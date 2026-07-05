import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { getArticle } from "@/lib/queries";
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

export default async function KabarDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  return (
    <article className="py-[34px]">
      <div className="mx-auto max-w-[720px] px-5">
        <Link href="/kabar" className="text-[13px] font-bold text-kongsi-grenadine">
          ← Kabar Kongsi
        </Link>
        <div className="mt-3 text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-grenadine">
          {a.tag}
        </div>
        <h1 className="mt-1 font-fraunces text-[34px] font-black leading-[1.08] text-kongsi-indigo">
          {a.title}
        </h1>
        <div
          className={cn(
            "my-6 h-[180px] rounded-[6px] border-2 border-kongsi-ink shadow-hard",
            toneBg[a.tone],
          )}
        />
        <div className="space-y-4 text-[15px] leading-7 text-kongsi-ink">
          {a.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
