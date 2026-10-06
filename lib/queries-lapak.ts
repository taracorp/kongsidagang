import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Tone } from "@/components/kongsi/ProdukCard";
import type { CabangPilihan } from "@/components/kongsi/AddToCartButton";

// Bacaan lapak & produk (tanpa data contoh: DB kosong = tampilan kosong yang jujur).

const asTone = (t: unknown): Tone => ((t as Tone) || "sage") as Tone;

export type ProdukTampil = {
  id: string;
  name: string;
  shop: string;
  shopSlug: string;
  price: number;
  oldPrice?: number;
  tone: Tone;
  logo: string | null;
  category: string | null;
  description: string | null;
  validDays: number;
  branches: CabangPilihan[];
};

const PRODUK_SELECT = {
  id: true,
  name: true,
  price: true,
  old_price: true,
  tone: true,
  category: true,
  description: true,
  valid_days: true,
  merchant: {
    select: {
      slug: true,
      name: true,
      logo_url: true,
      branches: { where: { is_active: true }, select: { id: true, name: true, city: true }, orderBy: { sort: "asc" as const } },
    },
  },
} as const;

type BarisProduk = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  tone: string;
  category: string | null;
  description: string | null;
  valid_days: number;
  merchant: { slug: string; name: string; logo_url: string | null; branches: CabangPilihan[] };
};

function keProduk(p: BarisProduk): ProdukTampil {
  return {
    id: p.id,
    name: p.name,
    shop: p.merchant.name,
    shopSlug: p.merchant.slug,
    price: p.price,
    oldPrice: p.old_price ?? undefined,
    tone: asTone(p.tone),
    logo: p.merchant.logo_url,
    category: p.category,
    description: p.description,
    validDays: p.valid_days,
    branches: p.merchant.branches,
  };
}

// Produk yang bisa dibeli: aktif, lapak aktif & menerima pesanan.
const LAPAK_BUKA: Prisma.MerchantWhereInput = { is_active: true, status: { in: ["buka", "obral"] } };
const BISA_DIBELI: Prisma.MerchantProductWhereInput = { is_active: true, merchant: LAPAK_BUKA };

// ------------------------------------------------------------
// Daftar & detail lapak
// ------------------------------------------------------------

export type LapakKartu = {
  slug: string;
  name: string;
  category: string;
  rating: number;
  tone: Tone;
  sealed: boolean;
  status: string;
  logo: string | null;
  city: string | null;
  jumlahProduk: number;
  jumlahCabang: number;
};

export async function getLapakList(): Promise<LapakKartu[]> {
  await connection();
  const data = await prisma.merchant.findMany({
    where: { is_active: true },
    select: {
      slug: true,
      name: true,
      category: true,
      rating: true,
      tone: true,
      is_sealed: true,
      status: true,
      logo_url: true,
      city: true,
      _count: { select: { products: { where: { is_active: true } }, branches: { where: { is_active: true } } } },
    },
    orderBy: [{ tebusan_count: "desc" }, { created_at: "asc" }],
  });
  return data.map((m) => ({
    slug: m.slug,
    name: m.name,
    category: m.category,
    rating: Number(m.rating),
    tone: asTone(m.tone),
    sealed: m.is_sealed,
    status: m.status,
    logo: m.logo_url,
    city: m.city,
    jumlahProduk: m._count.products,
    jumlahCabang: m._count.branches,
  }));
}

export type LapakDetail = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  logo: string | null;
  whatsapp: string | null;
  website: string | null;
  hours: string | null;
  city: string | null;
  sealed: boolean;
  status: string;
  tone: Tone;
  rating: number;
  tebusan: number;
  flashSaleEndsAt: string | null;
  branches: { id: string; name: string; address: string; city: string | null }[];
  kelompok: { category: string; products: ProdukTampil[] }[];
};

export async function getLapakDetail(slug: string): Promise<LapakDetail | null> {
  await connection();
  const m = await prisma.merchant.findFirst({
    where: { slug, is_active: true },
    include: {
      branches: { where: { is_active: true }, orderBy: { sort: "asc" } },
      products: {
        where: { is_active: true },
        select: PRODUK_SELECT,
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
      },
    },
  });
  if (!m) return null;
  const kelompok = new Map<string, ProdukTampil[]>();
  for (const p of m.products) {
    const k = p.category || "Lainnya";
    kelompok.set(k, [...(kelompok.get(k) ?? []), keProduk(p)]);
  }
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    category: m.category,
    description: m.description,
    logo: m.logo_url,
    whatsapp: m.whatsapp,
    website: m.website,
    hours: m.hours,
    city: m.city,
    sealed: m.is_sealed,
    status: m.status,
    tone: asTone(m.tone),
    rating: Number(m.rating),
    tebusan: m.tebusan_count,
    flashSaleEndsAt: m.status === "obral" && m.flash_sale_ends_at ? m.flash_sale_ends_at.toISOString() : null,
    branches: m.branches.map((b) => ({ id: b.id, name: b.name, address: b.address, city: b.city })),
    kelompok: [...kelompok.entries()].map(([category, products]) => ({ category, products })),
  };
}

// ------------------------------------------------------------
// Beranda: Etalase & Pilihan Untukmu
// ------------------------------------------------------------

export async function getFeatured(userId: string | null): Promise<{
  etalase: ProdukTampil[];
  pilihan: ProdukTampil[];
  pilihanDari: "diikuti" | "terpopuler";
}> {
  await connection();
  const etalase = await prisma.merchantProduct.findMany({
    where: { ...BISA_DIBELI, is_featured: true },
    select: PRODUK_SELECT,
    orderBy: [{ sort: "asc" }, { created_at: "asc" }],
    take: 6,
  });
  const sudah = etalase.map((p) => p.id);
  const diikuti = userId
    ? (await prisma.follow.findMany({ where: { user_id: userId }, select: { merchant_id: true } })).map((f) => f.merchant_id)
    : [];
  const pilihan = await prisma.merchantProduct.findMany({
    where: {
      ...BISA_DIBELI,
      id: { notIn: sudah },
      ...(diikuti.length ? { merchant_id: { in: diikuti } } : {}),
    },
    select: PRODUK_SELECT,
    orderBy: [{ merchant: { tebusan_count: "desc" } }, { sort: "asc" }],
    take: 4,
  });
  return {
    etalase: etalase.map(keProduk),
    pilihan: pilihan.map(keProduk),
    pilihanDari: diikuti.length ? "diikuti" : "terpopuler",
  };
}

// ------------------------------------------------------------
// Neraca: bandingkan harga perawatan antar-lapak
// ------------------------------------------------------------

export type NeracaBaris = {
  rank: number;
  productId: string;
  name: string;
  lapak: string;
  lapakSlug: string;
  sealed: boolean;
  rating: number;
  price: number;
  cheapest: boolean;
};

export async function getNeraca(query: string): Promise<NeracaBaris[]> {
  await connection();
  const q = query.trim();
  if (!q) return [];
  const data = await prisma.merchantProduct.findMany({
    where: { ...BISA_DIBELI, name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, price: true, merchant: { select: { name: true, slug: true, is_sealed: true, rating: true } } },
    orderBy: [{ merchant: { is_sealed: "desc" } }, { price: "asc" }],
    take: 10,
  });
  const termurah = Math.min(...data.map((p) => p.price));
  return data.map((p, i) => ({
    rank: i + 1,
    productId: p.id,
    name: p.name,
    lapak: p.merchant.name,
    lapakSlug: p.merchant.slug,
    sealed: p.merchant.is_sealed,
    rating: Number(p.merchant.rating),
    price: p.price,
    cheapest: p.price === termurah,
  }));
}

// ------------------------------------------------------------
// Juru Tunjuk: produk berdasar tag + anggaran (+ kota cabang)
// ------------------------------------------------------------

export async function cariProdukTag(tag: string, min: number, maks: number, kota: string | null): Promise<ProdukTampil[]> {
  const data = await prisma.merchantProduct.findMany({
    where: {
      ...BISA_DIBELI,
      tags: { has: tag },
      price: { gte: min, lte: maks },
      ...(kota ? { merchant: { ...LAPAK_BUKA, branches: { some: { city: { contains: kota, mode: "insensitive" }, is_active: true } } } } : {}),
    },
    select: PRODUK_SELECT,
    orderBy: { price: "asc" },
    take: 6,
  });
  return data.map(keProduk);
}

/** Kota-kota cabang aktif (untuk pilihan Juru Tunjuk). */
export async function getKotaCabang(): Promise<string[]> {
  const rows = await prisma.merchantBranch.findMany({
    where: { is_active: true, merchant: { is_active: true } },
    select: { city: true },
    distinct: ["city"],
  });
  return rows.map((r) => r.city).filter((c): c is string => !!c).sort();
}

// ------------------------------------------------------------
// Kelola Lapak (pemilik / admin)
// ------------------------------------------------------------

export type LapakKelola = {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  description: string | null;
  whatsapp: string | null;
  hours: string | null;
  logo: string | null;
  branches: { id: string; name: string; address: string; city: string | null; is_active: boolean }[];
  products: {
    id: string;
    name: string;
    price: number;
    old_price: number | null;
    tone: Tone;
    is_active: boolean;
    category: string | null;
    description: string | null;
    valid_days: number;
    is_featured: boolean;
    tags: string[];
  }[];
};

export async function getLapakKelola(userId: string, admin: boolean): Promise<LapakKelola[]> {
  await connection();
  const data = await prisma.merchant.findMany({
    where: admin ? { OR: [{ owner_id: userId }, { owner_id: null }] } : { owner_id: userId },
    include: {
      branches: { orderBy: { sort: "asc" } },
      products: { orderBy: [{ sort: "asc" }, { created_at: "asc" }] },
    },
    orderBy: { created_at: "asc" },
  });
  return data.map((m) => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    category: m.category,
    status: m.status,
    description: m.description,
    whatsapp: m.whatsapp,
    hours: m.hours,
    logo: m.logo_url,
    branches: m.branches.map((b) => ({ id: b.id, name: b.name, address: b.address, city: b.city, is_active: b.is_active })),
    products: m.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      old_price: p.old_price,
      tone: asTone(p.tone),
      is_active: p.is_active,
      category: p.category,
      description: p.description,
      valid_days: p.valid_days,
      is_featured: p.is_featured,
      tags: p.tags,
    })),
  }));
}

/** Voucher terakhir yang ditebus di lapak (riwayat validasi petugas). */
export async function getRiwayatTebus(merchantId: string, take = 20) {
  const rows = await prisma.voucher.findMany({
    where: { merchant_id: merchantId, status: "terpakai" },
    select: { code: true, title: true, redeemed_at: true, branch: { select: { name: true } }, user: { select: { name: true, email: true } } },
    orderBy: { redeemed_at: "desc" },
    take,
  });
  return rows.map((r) => ({
    code: r.code,
    title: r.title,
    at: r.redeemed_at?.toISOString() ?? null,
    cabang: r.branch?.name ?? null,
    pembeli: r.user.name || r.user.email,
  }));
}
