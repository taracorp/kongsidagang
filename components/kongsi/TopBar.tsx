"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassRose, IconCart, IconBell } from "./icons";
import { useCart } from "./cart";
import { authClient } from "@/lib/auth-client";
import { ringkasanTopBar } from "@/app/actions/kabar";

function IconButton({
  children,
  count,
  label,
  href,
}: {
  children: React.ReactNode;
  count?: number;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} aria-label={label} title={label}>
      <span className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 text-kongsi-ink">
        {children}
        {count && count > 0 ? (
          <span className="absolute -right-[6px] -top-[6px] flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-[1.5px] border-kongsi-ink bg-kongsi-grenadine px-[3px] text-[10px] font-bold text-kongsi-parchment">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

const ringkas = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : n.toLocaleString("id-ID");

export function TopBar() {
  const { count: cartCount } = useCart();
  const { data: session } = authClient.useSession();
  const loggedIn = Boolean(session?.user);
  const pathname = usePathname();
  const [info, setInfo] = useState<{ belum: number; saldo: number } | null>(null);

  // Layout tidak dirender ulang saat pindah halaman → ambil ringkasan tiap halaman berganti & tiap 60 detik.
  useEffect(() => {
    if (!loggedIn) return;
    let aktif = true;
    const muat = () => ringkasanTopBar().then((r) => aktif && setInfo(r));
    muat();
    const t = setInterval(muat, 60_000);
    return () => {
      aktif = false;
      clearInterval(t);
    };
  }, [loggedIn, pathname]);
  const tampil = loggedIn ? info : null;

  return (
    <div className="sticky top-0 z-50 border-b-2 border-kongsi-ink bg-kongsi-parchment">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-5 py-[11px]">
        <Link href="/" className="flex items-center gap-[10px]">
          <CompassRose size={30} className="text-kongsi-grenadine" />
          <div>
            <div className="font-fraunces text-[19px] font-black leading-none text-kongsi-indigo">Kongsi Dagang</div>
            <div className="hidden text-[9px] font-bold uppercase tracking-[2.5px] text-kongsi-olive sm:block">
              Jalur Rempah Nusantara
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <IconButton label="Keranjang" href="/keranjang" count={cartCount}>
            <IconCart size={19} />
          </IconButton>
          <IconButton label="Kabar untukmu" href="/kabar-saya" count={tampil?.belum}>
            <IconBell size={19} />
          </IconButton>
          <Link
            href={loggedIn ? "/pakhuis" : "/masuk"}
            className="whitespace-nowrap rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-[13px] py-[5px] text-center text-[13px] font-bold leading-tight text-kongsi-ink shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#3a2417]"
          >
            {loggedIn ? "Pakhuis-ku" : "Masuk"}
            {tampil ? <span className="block text-[10px] font-semibold">{ringkas(tampil.saldo)} Keteng</span> : null}
          </Link>
        </div>
      </div>
    </div>
  );
}
