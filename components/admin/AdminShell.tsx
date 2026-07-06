"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CompassRose,
  WaxSeal,
  IconHome,
  IconShop,
  IconScale,
  IconNews,
} from "@/components/kongsi/icons";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import type { StaffRole } from "@/lib/roles";

type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: "all" | "kabar" | "adminUp" | "ketua";
};

const items: Item[] = [
  { href: "/admin", label: "Ringkasan", Icon: IconHome, roles: "all" },
  { href: "/admin/lelang", label: "Balai Lelang", Icon: CompassRose, roles: "adminUp" },
  { href: "/admin/saudagar", label: "Saudagar", Icon: IconShop, roles: "adminUp" },
  { href: "/admin/neraca", label: "Neraca & Pariwara", Icon: IconScale, roles: "adminUp" },
  { href: "/admin/kabar", label: "Kabar", Icon: IconNews, roles: "kabar" },
  { href: "/admin/peran", label: "Atur Peran", Icon: WaxSeal, roles: "ketua" },
];

function visible(role: StaffRole | null, need: Item["roles"]) {
  if (need === "all") return role != null;
  if (need === "kabar") return role != null;
  if (need === "adminUp") return role === "admin" || role === "ketua";
  if (need === "ketua") return role === "ketua";
  return false;
}

const roleLabel: Record<string, string> = {
  pewarta: "Pewarta",
  admin: "Admin Kongsi",
  ketua: "Ketua Kongsi",
};

export function AdminShell({
  role,
  name,
  children,
}: {
  role: StaffRole | null;
  name: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = items.filter((it) => visible(role, it.roles));
  const active =
    nav.find(
      (it) =>
        pathname === it.href ||
        (it.href !== "/admin" && pathname.startsWith(it.href)),
    ) ?? nav[0];

  const w = collapsed ? "w-[68px]" : "w-[230px]";

  return (
    <div className="min-h-screen bg-kongsi-parchment-3 text-kongsi-ink">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r-2 border-kongsi-ink bg-kongsi-indigo-dark text-kongsi-parchment transition-all duration-200",
          w,
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 border-b-2 border-black/30 px-4 py-4">
          <CompassRose size={26} className="text-kongsi-beeswax" />
          {!collapsed && (
            <span className="font-fraunces text-[15px] font-black leading-tight text-kongsi-beeswax">
              Kantor Kongsi
            </span>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {nav.map((it) => {
            const on = active?.href === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "mx-2 mb-1 flex items-center gap-3 rounded-[5px] px-3 py-[10px] text-[13px] font-bold transition-colors",
                  on
                    ? "bg-kongsi-beeswax text-kongsi-ink"
                    : "text-[#c9d6da] hover:bg-white/10",
                )}
                title={it.label}
              >
                <it.Icon size={19} />
                {!collapsed && <span>{it.label}</span>}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden border-t-2 border-black/30 px-4 py-3 text-left text-[12px] font-bold text-[#c9d6da] hover:bg-white/10 md:block"
        >
          {collapsed ? "»" : "« Kecilkan"}
        </button>
      </aside>

      {/* Overlay mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Konten */}
      <div className={cn("transition-all", collapsed ? "md:pl-[68px]" : "md:pl-[230px]")}>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-kongsi-ink bg-kongsi-parchment px-5 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-[4px] border-2 border-kongsi-ink px-2 py-1 text-sm font-bold md:hidden"
            aria-label="Buka menu"
          >
            ☰
          </button>
          <h1 className="flex-1 font-fraunces text-lg font-black text-kongsi-indigo">
            {active?.label ?? "Kantor Kongsi"}
          </h1>
          <div className="hidden text-right text-[12px] leading-tight sm:block">
            <div className="font-bold">{name}</div>
            <div className="text-kongsi-ink-soft">
              {role ? roleLabel[role] : "—"}
            </div>
          </div>
          <LogoutButton />
        </header>

        <main className="mx-auto max-w-[1200px] px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
