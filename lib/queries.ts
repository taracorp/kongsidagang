import "server-only";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getStaffSession, isAdminUp, canEditKabar, isKetua, isSuperadminEmail } from "@/lib/roles";
import type { Tone } from "@/components/kongsi/ProdukCard";
import {
  merchants as dummyMerchants,
  getMerchant as dummyGetMerchant,
  etalaseKurasi,
  pilihanUntukmu,
  type Merchant,
  type Produk,
} from "@/lib/dummy";
import {
  neracaRows as dummyNeraca,
  barterItems as dummyBarter,
  artikel as dummyArtikel,
  type NeracaRow,
  type BarterItem,
  type Artikel,
} from "@/lib/data-e";

const asTone = (t: unknown): Tone => (t as Tone) ?? "sage";

export type LojiKartu = {
  slug: string;
  name: string;
  category: string;
  rating: number;
  tone: Tone;
  sealed: boolean;
  status: "buka" | "obral";
};

export async function getLojiList(): Promise<LojiKartu[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
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
      },
      orderBy: { tebusan_count: "desc" },
    });
    if (data.length) {
      return data.map((m) => ({
        slug: m.slug,
        name: m.name,
        category: m.category,
        rating: Number(m.rating),
        tone: asTone(m.tone),
        sealed: m.is_sealed,
        status: m.status === "obral" ? "obral" : "buka",
      }));
    }
  } catch {
    // fallback ke dummy
  }
  return dummyMerchants.map((m) => ({
    slug: m.slug,
    name: m.name,
    category: m.category,
    rating: m.rating,
    tone: m.tone,
    sealed: Boolean(m.sealed),
    status: m.status,
  }));
}

export async function getLojiDetail(slug: string): Promise<Merchant | null> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const m = await prisma.merchant.findFirst({
      where: { slug, is_active: true },
      include: {
        products: {
          where: { is_active: true },
          select: { name: true, price: true, old_price: true, tone: true },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (m) {
      return {
        slug: m.slug,
        name: m.name,
        category: m.category,
        rating: Number(m.rating),
        tone: asTone(m.tone),
        sealed: m.is_sealed,
        status: m.status === "obral" ? "obral" : "buka",
        city: m.city ?? "",
        tebusan: m.tebusan_count,
        coverFrom: asTone(m.cover_from ?? m.tone),
        coverTo: asTone(m.cover_to ?? m.tone),
        flashSale: m.status === "obral" ? "03:14:22" : undefined,
        products: m.products.map((p) => ({
          name: p.name,
          shop: m.name,
          price: p.price,
          oldPrice: p.old_price ?? undefined,
          tone: asTone(p.tone),
        })),
        id: m.id,
      };
    }
  } catch {
    // fallback
  }
  return dummyGetMerchant(slug) ?? null;
}

export type LapakProduct = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  tone: Tone;
  is_active: boolean;
};
export type LapakMerchant = {
  id: string;
  slug: string;
  name: string;
  category: string;
  is_sealed: boolean;
  status: string;
  products: LapakProduct[];
};

export async function getMyMerchants(userId: string): Promise<LapakMerchant[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.merchant.findMany({
      where: { owner_id: userId },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        is_sealed: true,
        status: true,
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            old_price: true,
            tone: true,
            is_active: true,
          },
          orderBy: { created_at: "asc" },
        },
      },
      orderBy: { created_at: "asc" },
    });
    return data.map((m) => ({
      ...m,
      products: m.products.map((p) => ({ ...p, tone: asTone(p.tone) })),
    }));
  } catch {
    return [];
  }
}

export async function getIsFollowing(merchantId: string): Promise<{
  loggedIn: boolean;
  following: boolean;
}> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const user = await getSessionUser();
    if (!user) return { loggedIn: false, following: false };
    const row = await prisma.follow.findUnique({
      where: { user_id_merchant_id: { user_id: user.id, merchant_id: merchantId } },
    });
    return { loggedIn: true, following: Boolean(row) };
  } catch {
    return { loggedIn: false, following: false };
  }
}

export async function getFeatured(): Promise<{
  etalase: Produk[];
  pilihan: Produk[];
}> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.merchantProduct.findMany({
      where: { is_active: true },
      select: {
        name: true,
        price: true,
        old_price: true,
        tone: true,
        merchant: { select: { name: true } },
      },
      take: 20,
    });
    if (data.length) {
      const mapped: Produk[] = data.map((p) => ({
        name: p.name,
        shop: p.merchant.name,
        price: p.price,
        oldPrice: p.old_price ?? undefined,
        tone: asTone(p.tone),
      }));
      return { etalase: mapped.slice(0, 5), pilihan: mapped.slice(5, 9) };
    }
  } catch {
    // fallback
  }
  return { etalase: etalaseKurasi, pilihan: pilihanUntukmu };
}

export async function getNeraca(productKey: string): Promise<NeracaRow[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.priceListing.findMany({
      where: { product_key: productKey },
      select: { loji_name: true, is_sealed: true, rating: true, price: true },
      orderBy: { price: "asc" },
      take: 10,
    });
    if (data.length) {
      return data.map((r, i) => ({
        rank: i + 1,
        loji: r.loji_name,
        sealed: r.is_sealed,
        rating: Number(r.rating),
        price: r.price,
        cheapest: i === 0,
      }));
    }
  } catch {
    // fallback
  }
  return dummyNeraca;
}

export async function getNeracaByName(query: string): Promise<{
  rows: NeracaRow[];
  matched: string | null;
}> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.merchantProduct.findMany({
      where: {
        is_active: true,
        name: { contains: query, mode: "insensitive" },
      },
      select: {
        name: true,
        price: true,
        merchant: { select: { name: true, is_sealed: true, rating: true } },
      },
      orderBy: { price: "asc" },
      take: 12,
    });
    if (data.length) {
      const rows: NeracaRow[] = data.map((p, i) => ({
        rank: i + 1,
        loji: p.merchant.name,
        sealed: p.merchant.is_sealed,
        rating: Number(p.merchant.rating),
        price: p.price,
        cheapest: i === 0,
      }));
      return { rows, matched: data[0].name };
    }
  } catch {
    // fallback
  }
  return { rows: [], matched: null };
}

export async function getBarter(): Promise<BarterItem[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.barterItem.findMany({
      where: { status: "aktif" },
      select: { title: true, est_value: true, want_text: true, city: true, tone: true },
      orderBy: { created_at: "desc" },
    });
    if (data.length) {
      return data.map((b) => ({
        title: b.title,
        owner: "Saudagar",
        city: b.city ?? "",
        estValue: b.est_value,
        want: b.want_text ?? "",
        tone: asTone(b.tone),
      }));
    }
  } catch {
    // fallback
  }
  return dummyBarter;
}

export type BarterRow = {
  id: string;
  user_id: string;
  title: string;
  est_value: number;
  want_text: string | null;
  city: string | null;
  tone: Tone;
  photo_url: string | null;
};

const BARTER_ROW_SELECT = {
  id: true,
  user_id: true,
  title: true,
  est_value: true,
  want_text: true,
  city: true,
  tone: true,
  photo_url: true,
} as const;

export async function getBarterRows(): Promise<BarterRow[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.barterItem.findMany({
      where: { status: "aktif" },
      select: BARTER_ROW_SELECT,
      orderBy: { created_at: "desc" },
    });
    return data.map((b) => ({ ...b, tone: asTone(b.tone) }));
  } catch {
    return [];
  }
}

export type BarterDeal = {
  id: string;
  status: string;
  topup: number;
  myItem: string;
  theirItem: string;
  iAmRecipient: boolean;
  counterpartyId: string | null;
  ratedByMe: boolean;
};

export async function getMyBarter(userId: string): Promise<{
  mine: BarterRow[];
  deals: BarterDeal[];
}> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const [mineRows, dealRows, ratings] = await Promise.all([
      prisma.barterItem.findMany({
        where: { user_id: userId, status: "aktif" },
        select: BARTER_ROW_SELECT,
        orderBy: { created_at: "desc" },
      }),
      // Hanya deal yang melibatkan user ini (dulu dijaga RLS).
      prisma.barterDeal.findMany({
        where: {
          OR: [{ itemA: { user_id: userId } }, { itemB: { user_id: userId } }],
        },
        select: {
          id: true,
          topup_keping: true,
          status: true,
          itemA: { select: { title: true, user_id: true } },
          itemB: { select: { title: true, user_id: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.barterRating.findMany({
        where: { rater_id: userId },
        select: { deal_id: true },
      }),
    ]);

    const ratedSet = new Set(ratings.map((r) => r.deal_id));
    const mine = mineRows.map((b) => ({ ...b, tone: asTone(b.tone) }));
    const deals: BarterDeal[] = dealRows.map((d) => {
      const a = d.itemA;
      const b = d.itemB;
      const iAmRecipient = b.user_id === userId;
      return {
        id: d.id,
        status: d.status,
        topup: d.topup_keping,
        myItem: iAmRecipient ? b.title : a.title,
        theirItem: iAmRecipient ? a.title : b.title,
        iAmRecipient,
        counterpartyId: iAmRecipient ? a.user_id : b.user_id,
        ratedByMe: ratedSet.has(d.id),
      };
    });

    return { mine, deals };
  } catch {
    return { mine: [], deals: [] };
  }
}

export type DisputeDeal = {
  id: string;
  topup: number;
  itemA: string;
  itemB: string;
};

export async function getDisputedDeals(): Promise<DisputeDeal[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const { role } = await getStaffSession();
    if (!isAdminUp(role)) return [];
    const data = await prisma.barterDeal.findMany({
      where: { status: "disputed" },
      select: {
        id: true,
        topup_keping: true,
        itemA: { select: { title: true } },
        itemB: { select: { title: true } },
      },
      orderBy: { created_at: "desc" },
    });
    return data.map((d) => ({
      id: d.id,
      topup: d.topup_keping,
      itemA: d.itemA.title,
      itemB: d.itemB.title,
    }));
  } catch {
    return [];
  }
}

export async function getArticles(): Promise<Artikel[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const data = await prisma.article.findMany({
      where: { published_at: { not: null, lte: new Date() } },
      select: {
        slug: true,
        title: true,
        tag: true,
        excerpt: true,
        cover_tone: true,
        body: true,
      },
      orderBy: { published_at: "desc" },
    });
    if (data.length) {
      return data.map((a) => ({
        slug: a.slug,
        title: a.title,
        tag: a.tag,
        excerpt: a.excerpt ?? "",
        tone: asTone(a.cover_tone),
        body: a.body,
      }));
    }
  } catch {
    // fallback
  }
  return dummyArtikel;
}

export async function getArticle(slug: string): Promise<Artikel | null> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  const all = await getArticles();
  return all.find((a) => a.slug === slug) ?? null;
}

export type AuctionPublic = {
  id: string;
  type: string;
  clue_category: string;
  clue_name_masked: string;
  normal_price: number;
  facilities: string[];
  status: string;
  capacity: number;
  peserta_count: number;
  revealed_price: number | null;
  winning_guess: number | null;
  winner_id: string | null;
  winner_name: string | null;
};

const REVEAL_STATUSES = ["pemenang", "bayar", "selesai"];

/**
 * Pengganti view auction_items_public. Harga rahasia (deal_price, set_price)
 * HANYA dibaca untuk dibuka saat fase reveal; deal_price tidak pernah keluar.
 */
async function getPublicAuctionItems(
  type: "reguler" | "vendu",
  take?: number,
): Promise<AuctionPublic[]> {
  const rows = await prisma.auction.findMany({
    where: { type, status: { not: "selesai" } },
    select: {
      id: true,
      type: true,
      clue_category: true,
      clue_name_masked: true,
      normal_price: true,
      facilities: true,
      status: true,
      capacity: true,
      set_price: true,
      winning_guess: true,
      winner_id: true,
      winner: {
        select: { name: true, email: true, profile: { select: { full_name: true } } },
      },
      _count: { select: { participants: true } },
    },
    orderBy: { created_at: "asc" },
    take,
  });
  return rows.map((a) => {
    const reveal = REVEAL_STATUSES.includes(a.status);
    return {
      id: a.id,
      type: a.type,
      clue_category: a.clue_category,
      clue_name_masked: a.clue_name_masked,
      normal_price: a.normal_price,
      facilities: a.facilities,
      status: a.status,
      capacity: a.capacity,
      peserta_count: a._count.participants,
      revealed_price: reveal ? a.set_price : null,
      winning_guess: reveal ? a.winning_guess : null,
      winner_id: a.winner_id,
      winner_name: a.winner
        ? a.winner.profile?.full_name || a.winner.name || a.winner.email.split("@")[0]
        : null,
    };
  });
}

export async function getActiveAuction(
  type: "reguler" | "vendu" = "reguler",
): Promise<AuctionPublic | null> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const [first] = await getPublicAuctionItems(type, 1);
    return first ?? null;
  } catch {
    return null;
  }
}

export type AdSettings = { video?: string; image?: string };

export async function getAdSettings(): Promise<AdSettings> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  const envVideo = process.env.NEXT_PUBLIC_AD_VIDEO_URL || undefined;
  const envImage = process.env.NEXT_PUBLIC_AD_IMAGE_URL || undefined;
  try {
    const data = await prisma.setting.findMany({
      where: { key: { in: ["ad_video_url", "ad_image_url"] } },
    });
    const map = Object.fromEntries(data.map((r) => [r.key, r.value ?? ""]));
    return {
      video: map["ad_video_url"] || envVideo,
      image: map["ad_image_url"] || envImage,
    };
  } catch {
    return { video: envVideo, image: envImage };
  }
}

export async function getMyGuess(auctionId: string): Promise<number | null> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const row = await prisma.auctionGuess.findFirst({
      where: { auction_id: auctionId, user_id: user.id },
      select: { guess: true },
      orderBy: { created_at: "desc" },
    });
    return row?.guess ?? null;
  } catch {
    return null;
  }
}

export async function getStageAuctions(
  type: "reguler" | "vendu" = "reguler",
): Promise<AuctionPublic[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    return await getPublicAuctionItems(type);
  } catch {
    return [];
  }
}

export async function getMyGuesses(
  ids: string[],
): Promise<Record<string, number>> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  if (!ids.length) return {};
  try {
    const user = await getSessionUser();
    if (!user) return {};
    const data = await prisma.auctionGuess.findMany({
      where: { auction_id: { in: ids }, user_id: user.id },
      select: { auction_id: true, guess: true },
      orderBy: { created_at: "asc" },
    });
    const map: Record<string, number> = {};
    for (const g of data) map[g.auction_id] = g.guess;
    return map;
  } catch {
    return {};
  }
}

export type AdminAuction = {
  id: string;
  clue_category: string;
  clue_name_masked: string;
  normal_price: number;
  deal_price: number | null;
  set_price: number | null;
  status: string;
};

export type AdminApplication = {
  id: string;
  loji_name: string;
  category: string;
  owner_name: string;
  whatsapp: string;
  status: string;
  created_at: string;
};

export type AdminOverview = {
  cards: { label: string; value: string; accent?: string }[];
  produkPerLoji: { label: string; value: number }[];
  lelangPerStatus: { label: string; value: number }[];
};

const ACTIVE_AUCTION = ["kumpul", "tebak", "jeda", "final"];

export async function getAdminOverview(): Promise<AdminOverview> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  const [aktif, pengajuan, loji, artikel, pelanggan, merchants, byStatus] =
    await Promise.all([
      prisma.auction.count({ where: { status: { in: ACTIVE_AUCTION } } }),
      prisma.merchantApplication.count({ where: { status: "pending" } }),
      prisma.merchant.count(),
      prisma.article.count(),
      prisma.profile.count(),
      prisma.merchant.findMany({
        where: { is_active: true },
        select: { name: true, _count: { select: { products: true } } },
      }),
      prisma.auction.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

  const produkPerLoji = merchants.map((m) => ({
    label: m.name.replace(/^Loji /, ""),
    value: m._count.products,
  }));

  const statusOrder = ["kumpul", "tebak", "jeda", "final", "pemenang", "bayar", "selesai"];
  const counts: Record<string, number> = {};
  for (const g of byStatus) counts[g.status] = g._count._all;
  const lelangPerStatus = statusOrder
    .filter((s) => counts[s])
    .map((s) => ({ label: s, value: counts[s] }));

  return {
    cards: [
      { label: "Lelang aktif", value: String(aktif), accent: "text-kongsi-grenadine" },
      { label: "Pengajuan Saudagar", value: String(pengajuan) },
      { label: "Loji terdaftar", value: String(loji), accent: "text-kongsi-ok" },
      { label: "Artikel", value: String(artikel) },
      { label: "Pelanggan", value: String(pelanggan) },
    ],
    produkPerLoji,
    lelangPerStatus,
  };
}

export type StaffUser = {
  user_id: string;
  email: string;
  full_name: string;
  role: "pewarta" | "admin" | "ketua" | null;
  is_super: boolean;
};

/** Daftar user + peran — khusus Ketua (pengganti RPC admin_list_users). */
export async function getAllUsersWithRoles(): Promise<StaffUser[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const { role } = await getStaffSession();
    if (!isKetua(role)) return [];
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        profile: { select: { full_name: true } },
        staffRole: { select: { role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return users
      .map((u) => {
        const is_super = isSuperadminEmail(u.email);
        return {
          user_id: u.id,
          email: u.email,
          full_name: u.profile?.full_name || u.name || "",
          role: is_super ? ("ketua" as const) : (u.staffRole?.role ?? null),
          is_super,
        };
      })
      .sort((a, b) => Number(a.role === null) - Number(b.role === null));
  } catch {
    return [];
  }
}

export async function getAdminData(): Promise<{
  auctions: AdminAuction[];
  applications: AdminApplication[];
  counts: { auctionsAktif: number; pengajuan: number; loji: number };
}> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) {
    return { auctions: [], applications: [], counts: { auctionsAktif: 0, pengajuan: 0, loji: 0 } };
  }
  const [auctions, apps, aktif, pengajuan, loji] = await Promise.all([
    prisma.auction.findMany({
      select: {
        id: true,
        clue_category: true,
        clue_name_masked: true,
        normal_price: true,
        deal_price: true,
        set_price: true,
        status: true,
      },
      orderBy: { created_at: "asc" },
    }),
    prisma.merchantApplication.findMany({
      select: {
        id: true,
        loji_name: true,
        category: true,
        owner_name: true,
        whatsapp: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.auction.count({ where: { status: { in: ACTIVE_AUCTION } } }),
    prisma.merchantApplication.count({ where: { status: "pending" } }),
    prisma.merchant.count(),
  ]);

  return {
    auctions,
    applications: apps.map((a) => ({ ...a, created_at: a.created_at.toISOString() })),
    counts: { auctionsAktif: aktif, pengajuan, loji },
  };
}

export type AdminArticle = {
  slug: string;
  title: string;
  tag: string;
  published_at: string | null;
};

export async function getAdminArticles(): Promise<AdminArticle[]> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  try {
    const { role } = await getStaffSession();
    if (!canEditKabar(role)) return [];
    const data = await prisma.article.findMany({
      select: { slug: true, title: true, tag: true, published_at: true },
      orderBy: { created_at: "desc" },
    });
    return data.map((a) => ({
      ...a,
      published_at: a.published_at?.toISOString() ?? null,
    }));
  } catch {
    return [];
  }
}

export type PakhuisData = {
  name: string;
  balance: number;
  level: string;
  stamps: number;
  totalSpend: number;
  vouchers: { id: string; title: string; note: string | null; status: string }[];
  ledger: { amount: number; kind: string; note: string | null; created_at: string }[];
  isSaudagar: boolean;
};

export async function getPakhuis(): Promise<PakhuisData | null> {
  await connection(); // data DB selalu per-request, jangan diprerender saat build
  const user = await getSessionUser();
  if (!user) return null;

  const [wallet, profile, vouchers, lapakCount, ledger] = await Promise.all([
    prisma.wallet.findUnique({ where: { user_id: user.id }, select: { balance: true } }),
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { level: true, stamps: true, full_name: true, total_spend: true },
    }),
    prisma.voucher.findMany({
      where: { user_id: user.id },
      select: { id: true, title: true, note: true, status: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.merchant.count({ where: { owner_id: user.id } }),
    prisma.walletTransaction.findMany({
      where: { user_id: user.id },
      select: { amount: true, kind: true, note: true, created_at: true },
      orderBy: { created_at: "desc" },
      take: 10,
    }),
  ]);

  return {
    name: profile?.full_name || user.name || user.email.split("@")[0] || "Saudagar",
    balance: wallet?.balance ?? 0,
    level: profile?.level ?? "pelanggan_kecil",
    stamps: profile?.stamps ?? 0,
    totalSpend: profile?.total_spend ?? 0,
    vouchers,
    ledger: ledger.map((l) => ({ ...l, created_at: l.created_at.toISOString() })),
    isSaudagar: lapakCount > 0,
  };
}
