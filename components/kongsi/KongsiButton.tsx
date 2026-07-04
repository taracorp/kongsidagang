import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "gold" | "ghost";

const base =
  "inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-[22px] py-3 text-center text-sm font-bold no-underline transition-transform duration-100 hover:translate-x-[2px] hover:translate-y-[2px]";

const variants: Record<Variant, string> = {
  primary:
    "bg-kongsi-grenadine text-kongsi-parchment shadow-hard hover:shadow-hard-sm",
  gold: "bg-kongsi-beeswax text-kongsi-ink shadow-hard hover:shadow-hard-sm",
  ghost:
    "bg-transparent text-kongsi-ink shadow-[4px_4px_0_rgba(58,36,23,0.22)] hover:bg-kongsi-sage hover:shadow-[2px_2px_0_rgba(58,36,23,0.22)]",
};

type CommonProps = {
  variant?: Variant;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

export function KongsiButton({
  variant = "primary",
  block,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(base, variants[variant], block && "block w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function KongsiLinkButton({
  variant = "primary",
  block,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], block && "block w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
