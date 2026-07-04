import type { ReactNode } from "react";
import Link from "next/link";

export function RowHead({
  title,
  moreHref,
  moreLabel,
  note,
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  note?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-[10px]">
      <h3 className="font-fraunces text-[22px] font-black text-kongsi-indigo">
        {title}
      </h3>
      {moreHref ? (
        <Link
          href={moreHref}
          className="text-[13px] font-bold text-kongsi-grenadine"
        >
          {moreLabel ?? "Lihat semua"} →
        </Link>
      ) : note ? (
        <span className="text-[13px] font-bold text-kongsi-olive">{note}</span>
      ) : null}
    </div>
  );
}
