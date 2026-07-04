import type { ReactNode } from "react";
import { cn, formatKeping } from "@/lib/utils";
import { CompassRose } from "./icons";
import { AddToCartButton } from "./AddToCartButton";

export type Tone =
  | "sage"
  | "beeswax"
  | "beeswax-dark"
  | "grenadine"
  | "grenadine-dark"
  | "olive"
  | "indigo";

const toneBg: Record<Tone, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

export function ProdukCard({
  name,
  shop,
  price,
  oldPrice,
  tone = "sage",
  ribbon,
  addable,
  className,
}: {
  name: string;
  shop?: string;
  price: number;
  oldPrice?: number;
  tone?: Tone;
  ribbon?: ReactNode;
  addable?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex h-[104px] items-center justify-center border-b-2 border-kongsi-ink text-kongsi-indigo opacity-90",
          toneBg[tone],
        )}
      >
        {ribbon ? <div className="absolute left-2 top-2">{ribbon}</div> : null}
        <CompassRose size={30} />
      </div>
      <div className="flex flex-1 flex-col px-3 py-[10px]">
        <div className="flex-1 text-[13px] font-semibold leading-[1.3]">
          {name}
        </div>
        {shop ? (
          <div className="mt-1 text-[11px] font-semibold text-kongsi-olive">
            {shop}
          </div>
        ) : null}
        <div className="mt-[6px] font-fraunces text-base font-black text-kongsi-grenadine">
          {formatKeping(price)}
          {oldPrice ? (
            <span className="ml-[5px] text-[11px] font-normal text-kongsi-ink-soft line-through">
              {formatKeping(oldPrice)}
            </span>
          ) : null}
        </div>
        {addable ? (
          <AddToCartButton item={{ name, shop, price, tone }} />
        ) : null}
      </div>
    </div>
  );
}
