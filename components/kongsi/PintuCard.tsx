import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CompassRose } from "./icons";
import { SegelBadge } from "./Pill";
import type { Tone } from "./ProdukCard";

const toneBg: Record<Tone, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

export function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-[13px] text-kongsi-beeswax-dark">
      {"★".repeat(full)}
      {"☆".repeat(Math.max(0, 5 - full))}{" "}
      <span className="text-kongsi-ink-soft">{rating.toFixed(1)}</span>
    </span>
  );
}

export function PintuCard({
  name,
  category,
  rating,
  tone = "indigo",
  sealed,
  status,
  href = "#",
}: {
  name: string;
  category: string;
  rating: number;
  tone?: Tone;
  sealed?: boolean;
  status?: ReactNode;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard transition-transform duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-hard-lg"
    >
      <div className={cn("flex h-[88px] items-end p-[10px]", toneBg[tone])}>
        <CompassRose size={34} className="text-kongsi-parchment opacity-90" />
      </div>
      <div className="px-[15px] pb-4 pt-[13px]">
        <h4 className="flex flex-wrap items-center gap-[7px] font-fraunces text-lg font-black text-kongsi-indigo">
          {name}
          {sealed ? <SegelBadge /> : null}
        </h4>
        <div className="my-[2px] mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-kongsi-olive">
          {category}
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <Stars rating={rating} />
          {status}
        </div>
      </div>
    </Link>
  );
}
