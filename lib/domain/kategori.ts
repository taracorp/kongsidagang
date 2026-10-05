import "server-only";
import { prisma } from "@/lib/db";
import type { ChecklistItem, TaksiranCategory } from "@/lib/domain/taksiran";

// Muat kategori taksiran + harga komoditas terbaru (sumber kebenaran untuk server & form).

const SELECT = {
  slug: true,
  name: true,
  kind: true,
  unit: true,
  rate_y1: true,
  rate_next: true,
  floor_pct: true,
  ship_weight_kg: true,
  needs_serial: true,
  serial_label: true,
  checklist: true,
  prices: { select: { price_per_unit: true }, orderBy: { created_at: "desc" as const }, take: 1 },
} as const;

type Row = {
  slug: string;
  name: string;
  kind: string;
  unit: string | null;
  rate_y1: number;
  rate_next: number;
  floor_pct: number;
  ship_weight_kg: number;
  needs_serial: boolean;
  serial_label: string | null;
  checklist: unknown;
  prices: { price_per_unit: number }[];
};

function toCategory({ prices, checklist, kind, ...c }: Row): TaksiranCategory {
  return {
    ...c,
    kind: kind === "komoditas" ? "komoditas" : "aset",
    checklist: Array.isArray(checklist) ? (checklist as ChecklistItem[]) : [],
    price_per_unit: prices[0]?.price_per_unit ?? null,
  };
}

export async function loadCategories(): Promise<TaksiranCategory[]> {
  const rows = await prisma.barterCategory.findMany({
    where: { active: true },
    select: SELECT,
    orderBy: [{ sort: "asc" }, { name: "asc" }],
  });
  return rows.map(toCategory);
}

export async function loadCategory(slug: string): Promise<TaksiranCategory | null> {
  const row = await prisma.barterCategory.findFirst({ where: { slug, active: true }, select: SELECT });
  return row ? toCategory(row) : null;
}
