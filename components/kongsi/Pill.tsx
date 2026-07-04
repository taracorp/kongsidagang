import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WaxSeal } from "./icons";

type PillVariant = "sage" | "gold" | "live" | "indigo";

const pillVariants: Record<PillVariant, string> = {
  sage: "bg-kongsi-sage text-kongsi-ink",
  gold: "bg-kongsi-beeswax text-kongsi-ink",
  live: "bg-kongsi-grenadine text-kongsi-parchment",
  indigo: "bg-kongsi-indigo text-kongsi-parchment",
};

export function Pill({
  variant = "sage",
  className,
  children,
}: {
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-[1.5px] border-kongsi-ink px-[9px] py-[3px] text-[11px] font-bold uppercase tracking-[0.6px]",
        pillVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SegelBadge({
  label = "Segel",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-grenadine px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.5px] text-kongsi-parchment",
        className,
      )}
    >
      <WaxSeal size={10} />
      {label}
    </span>
  );
}
