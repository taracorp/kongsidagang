import Link from "next/link";
import { CompassRose, IconCart, IconBell } from "./icons";

function IconButton({
  children,
  count,
  label,
  href,
}: {
  children: React.ReactNode;
  count?: number;
  label: string;
  href?: string;
}) {
  const inner = (
    <span className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 text-kongsi-ink">
      {children}
      {count && count > 0 ? (
        <span className="absolute -right-[6px] -top-[6px] flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-[1.5px] border-kongsi-ink bg-kongsi-grenadine px-[3px] text-[10px] font-bold text-kongsi-parchment">
          {count}
        </span>
      ) : null}
    </span>
  );
  return href ? (
    <Link href={href} aria-label={label} title={label}>
      {inner}
    </Link>
  ) : (
    <button type="button" aria-label={label} title={label}>
      {inner}
    </button>
  );
}

export function TopBar({
  cartCount = 0,
  notifCount = 0,
}: {
  cartCount?: number;
  notifCount?: number;
}) {
  return (
    <div className="sticky top-0 z-50 border-b-2 border-kongsi-ink bg-kongsi-parchment">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-5 py-[11px]">
        <Link href="/" className="flex items-center gap-[10px]">
          <CompassRose size={30} className="text-kongsi-grenadine" />
          <div>
            <div className="font-fraunces text-[19px] font-black leading-none text-kongsi-indigo">
              Kongsi Dagang
            </div>
            <div className="hidden text-[9px] font-bold uppercase tracking-[2.5px] text-kongsi-olive sm:block">
              Jalur Rempah Nusantara
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <IconButton label="Keranjang" href="/keranjang" count={cartCount}>
            <IconCart size={19} />
          </IconButton>
          <IconButton label="Kabar Kongsi" href="/kabar" count={notifCount}>
            <IconBell size={19} />
          </IconButton>
          <Link
            href="/masuk"
            className="whitespace-nowrap rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-[15px] py-2 text-[13px] font-bold text-kongsi-ink shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#3a2417]"
          >
            Masuk Loji
          </Link>
        </div>
      </div>
    </div>
  );
}
