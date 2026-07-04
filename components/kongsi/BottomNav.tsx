"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { IconHome, IconBarter, IconScale, IconShop, IconNews } from "./icons";

const tabs = [
  { href: "/", label: "Beranda", Icon: IconHome, exact: true },
  { href: "/tukar", label: "Tukar Guling", Icon: IconBarter },
  { href: "/neraca", label: "Neraca", Icon: IconScale },
  { href: "/loji", label: "Loji", Icon: IconShop },
  { href: "/kabar", label: "Kabar", Icon: IconNews },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t-[3px] border-kongsi-ink bg-kongsi-indigo-dark px-1 pb-[10px] pt-2">
      {tabs.map(({ href, label, Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex max-w-[120px] flex-1 flex-col items-center gap-[3px] rounded-[5px] px-[6px] py-[2px] text-[10px] font-semibold transition-colors",
              active ? "text-kongsi-beeswax" : "text-[#9FBBC2]",
            )}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
