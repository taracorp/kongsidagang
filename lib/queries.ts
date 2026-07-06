import { createClient } from "@/lib/supabase/server";
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
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("merchants")
      .select("slug,name,category,rating,tone,is_sealed,status")
      .eq("is_active", true)
      .order("tebusan_count", { ascending: false });
    if (data?.length) {
      return data.map((m) => ({
        slug: m.slug,
        name: m.name,
        category: m.category,
        rating: Number(m.rating),
        tone: asTone(m.tone),
        sealed: Boolean(m.is_sealed),
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
  try {
    const supabase = await createClient();
    const { data: m } = await supabase
      .from("merchants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (m) {
      const { data: products } = await supabase
        .from("merchant_products")
        .select("name,price,old_price,tone")
        .eq("merchant_id", m.id)
        .eq("is_active", true)
        .order("created_at");
      return {
        slug: m.slug,
        name: m.name,
        category: m.category,
        rating: Number(m.rating),
        tone: asTone(m.tone),
        sealed: Boolean(m.is_sealed),
        status: m.status === "obral" ? "obral" : "buka",
        city: m.city ?? "",
        tebusan: m.tebusan_count ?? 0,
        coverFrom: asTone(m.cover_from ?? m.tone),
        coverTo: asTone(m.cover_to ?? m.tone),
        flashSale: m.status === "obral" ? "03:14:22" : undefined,
        products: (products ?? []).map((p) => ({
          name: p.name,
          shop: m.name,
          price: p.price,
          oldPrice: p.old_price ?? undefined,
          tone: asTone(p.tone),
        })),
        id: m.id as string,
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
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("merchants")
      .select(
        "id,slug,name,category,is_sealed,status,merchant_products(id,name,price,old_price,tone,is_active)",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    return (data ?? []).map((m) => ({
      id: m.id as string,
      slug: m.slug as string,
      name: m.name as string,
      category: m.category as string,
      is_sealed: Boolean(m.is_sealed),
      status: m.status as string,
      products: ((m.merchant_products as unknown[]) ?? []).map((p) => {
        const x = p as {
          id: string;
          name: string;
          price: number;
          old_price: number | null;
          tone: string;
          is_active: boolean;
        };
        return {
          id: x.id,
          name: x.name,
          price: x.price,
          old_price: x.old_price ?? null,
          tone: asTone(x.tone),
          is_active: x.is_active,
        };
      }),
    }));
  } catch {
    return [];
  }
}

export async function getIsFollowing(merchantId: string): Promise<{
  loggedIn: boolean;
  following: boolean;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { loggedIn: false, following: false };
    const { data } = await supabase
      .from("follows")
      .select("merchant_id")
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)
      .maybeSingle();
    return { loggedIn: true, following: Boolean(data) };
  } catch {
    return { loggedIn: false, following: false };
  }
}

export async function getFeatured(): Promise<{
  etalase: Produk[];
  pilihan: Produk[];
}> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("merchant_products")
      .select("name,price,old_price,tone,merchants(name)")
      .eq("is_active", true)
      .limit(20);
    if (data?.length) {
      const mapped: Produk[] = data.map((p) => {
        const rel = p.merchants as { name?: string } | { name?: string }[] | null;
        const shop = Array.isArray(rel) ? rel[0]?.name : rel?.name;
        return {
          name: p.name,
          shop: shop ?? "",
          price: p.price,
          oldPrice: p.old_price ?? undefined,
          tone: asTone(p.tone),
        };
      });
      return { etalase: mapped.slice(0, 5), pilihan: mapped.slice(5, 9) };
    }
  } catch {
    // fallback
  }
  return { etalase: etalaseKurasi, pilihan: pilihanUntukmu };
}

export async function getNeraca(productKey: string): Promise<NeracaRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("price_listings")
      .select("loji_name,is_sealed,rating,price")
      .eq("product_key", productKey)
      .order("price", { ascending: true })
      .limit(10);
    if (data?.length) {
      return data.map((r, i) => ({
        rank: i + 1,
        loji: r.loji_name,
        sealed: Boolean(r.is_sealed),
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
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("merchant_products")
      .select("name,price,merchants(name,is_sealed,rating)")
      .ilike("name", `%${query}%`)
      .eq("is_active", true)
      .order("price", { ascending: true })
      .limit(12);
    if (data?.length) {
      const rows: NeracaRow[] = data.map((p, i) => {
        const rel = p.merchants as
          | { name?: string; is_sealed?: boolean; rating?: number }
          | { name?: string; is_sealed?: boolean; rating?: number }[]
          | null;
        const m = Array.isArray(rel) ? rel[0] : rel;
        return {
          rank: i + 1,
          loji: m?.name ?? "Loji",
          sealed: Boolean(m?.is_sealed),
          rating: Number(m?.rating ?? 0),
          price: p.price,
          cheapest: i === 0,
        };
      });
      return { rows, matched: data[0].name as string };
    }
  } catch {
    // fallback
  }
  return { rows: [], matched: null };
}

export async function getBarter(): Promise<BarterItem[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("barter_items")
      .select("title,est_value,want_text,city,tone")
      .eq("status", "aktif")
      .order("created_at", { ascending: false });
    if (data?.length) {
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
};

export async function getBarterRows(): Promise<BarterRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("barter_items")
      .select("id,user_id,title,est_value,want_text,city,tone")
      .eq("status", "aktif")
      .order("created_at", { ascending: false });
    return (
      (data ?? []).map((b) => ({
        id: b.id as string,
        user_id: b.user_id as string,
        title: b.title as string,
        est_value: b.est_value as number,
        want_text: (b.want_text as string) ?? null,
        city: (b.city as string) ?? null,
        tone: asTone(b.tone),
      })) ?? []
    );
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
};

export async function getMyBarter(userId: string): Promise<{
  mine: BarterRow[];
  deals: BarterDeal[];
}> {
  try {
    const supabase = await createClient();
    const [mineRes, dealsRes] = await Promise.all([
      supabase
        .from("barter_items")
        .select("id,user_id,title,est_value,want_text,city,tone")
        .eq("user_id", userId)
        .eq("status", "aktif")
        .order("created_at", { ascending: false }),
      supabase
        .from("barter_deals")
        .select(
          "id,topup_keping,status,a:barter_items!barter_deals_item_a_fkey(title,user_id),b:barter_items!barter_deals_item_b_fkey(title,user_id)",
        )
        .order("created_at", { ascending: false }),
    ]);

    const mine: BarterRow[] = (mineRes.data ?? []).map((b) => ({
      id: b.id as string,
      user_id: b.user_id as string,
      title: b.title as string,
      est_value: b.est_value as number,
      want_text: (b.want_text as string) ?? null,
      city: (b.city as string) ?? null,
      tone: asTone(b.tone),
    }));

    const deals: BarterDeal[] = (dealsRes.data ?? []).map((d) => {
      const a = (Array.isArray(d.a) ? d.a[0] : d.a) as
        | { title?: string; user_id?: string }
        | undefined;
      const b = (Array.isArray(d.b) ? d.b[0] : d.b) as
        | { title?: string; user_id?: string }
        | undefined;
      const iAmRecipient = b?.user_id === userId;
      return {
        id: d.id as string,
        status: d.status as string,
        topup: (d.topup_keping as number) ?? 0,
        myItem: iAmRecipient ? (b?.title ?? "-") : (a?.title ?? "-"),
        theirItem: iAmRecipient ? (a?.title ?? "-") : (b?.title ?? "-"),
        iAmRecipient,
      };
    });

    return { mine, deals };
  } catch {
    return { mine: [], deals: [] };
  }
}

export async function getArticles(): Promise<Artikel[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("articles")
      .select("slug,title,tag,excerpt,cover_tone,body")
      .order("published_at", { ascending: false });
    if (data?.length) {
      return data.map((a) => ({
        slug: a.slug,
        title: a.title,
        tag: a.tag,
        excerpt: a.excerpt ?? "",
        tone: asTone(a.cover_tone),
        body: a.body ?? [],
      }));
    }
  } catch {
    // fallback
  }
  return dummyArtikel;
}

export async function getArticle(slug: string): Promise<Artikel | null> {
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

const AUCTION_COLS =
  "id,type,clue_category,clue_name_masked,normal_price,facilities,status,capacity,peserta_count,revealed_price,winning_guess,winner_id,winner_name";

export async function getActiveAuction(
  type: "reguler" | "vendu" = "reguler",
): Promise<AuctionPublic | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("auction_items_public")
      .select(AUCTION_COLS)
      .eq("type", type)
      .neq("status", "selesai")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as AuctionPublic | null) ?? null;
  } catch {
    return null;
  }
}

export type AdSettings = { video?: string; image?: string };

export async function getAdSettings(): Promise<AdSettings> {
  const envVideo = process.env.NEXT_PUBLIC_AD_VIDEO_URL || undefined;
  const envImage = process.env.NEXT_PUBLIC_AD_IMAGE_URL || undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["ad_video_url", "ad_image_url"]);
    const map = Object.fromEntries(
      (data ?? []).map((r) => [r.key, r.value as string]),
    );
    return {
      video: map["ad_video_url"] || envVideo,
      image: map["ad_image_url"] || envImage,
    };
  } catch {
    return { video: envVideo, image: envImage };
  }
}

export async function getMyGuess(auctionId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("auction_guesses")
      .select("guess")
      .eq("auction_id", auctionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.guess ?? null;
  } catch {
    return null;
  }
}

export async function getStageAuctions(
  type: "reguler" | "vendu" = "reguler",
): Promise<AuctionPublic[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("auction_items_public")
      .select(AUCTION_COLS)
      .eq("type", type)
      .neq("status", "selesai")
      .order("created_at", { ascending: true });
    return (data as AuctionPublic[]) ?? [];
  } catch {
    return [];
  }
}

export async function getMyGuesses(
  ids: string[],
): Promise<Record<string, number>> {
  if (!ids.length) return {};
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};
    const { data } = await supabase
      .from("auction_guesses")
      .select("auction_id,guess,created_at")
      .in("auction_id", ids)
      .order("created_at", { ascending: true });
    const map: Record<string, number> = {};
    for (const g of data ?? [])
      map[g.auction_id as string] = g.guess as number;
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

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();
  const [aktif, pengajuan, loji, artikel, pelanggan, merchantsRes, auctionsRes] =
    await Promise.all([
      supabase
        .from("auctions")
        .select("id", { count: "exact", head: true })
        .in("status", ["kumpul", "tebak", "jeda", "final"]),
      supabase
        .from("merchant_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("merchants").select("id", { count: "exact", head: true }),
      supabase.from("articles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("merchants")
        .select("name,merchant_products(count)")
        .eq("is_active", true),
      supabase.from("auctions").select("status"),
    ]);

  const produkPerLoji = (merchantsRes.data ?? []).map((m) => {
    const rel = m.merchant_products as { count?: number }[] | null;
    return {
      label: (m.name as string).replace(/^Loji /, ""),
      value: rel?.[0]?.count ?? 0,
    };
  });

  const statusOrder = [
    "kumpul",
    "tebak",
    "jeda",
    "final",
    "pemenang",
    "bayar",
    "selesai",
  ];
  const counts: Record<string, number> = {};
  for (const a of auctionsRes.data ?? [])
    counts[a.status as string] = (counts[a.status as string] ?? 0) + 1;
  const lelangPerStatus = statusOrder
    .filter((s) => counts[s])
    .map((s) => ({ label: s, value: counts[s] }));

  return {
    cards: [
      { label: "Lelang aktif", value: String(aktif.count ?? 0), accent: "text-kongsi-grenadine" },
      { label: "Pengajuan Saudagar", value: String(pengajuan.count ?? 0) },
      { label: "Loji terdaftar", value: String(loji.count ?? 0), accent: "text-kongsi-ok" },
      { label: "Artikel", value: String(artikel.count ?? 0) },
      { label: "Pelanggan", value: String(pelanggan.count ?? 0) },
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
};

export async function getAllUsersWithRoles(): Promise<StaffUser[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("admin_list_users");
    return (data as StaffUser[]) ?? [];
  } catch {
    return [];
  }
}

export async function getAdminData(): Promise<{
  auctions: AdminAuction[];
  applications: AdminApplication[];
  counts: { auctionsAktif: number; pengajuan: number; loji: number };
}> {
  const supabase = await createClient();
  const [auctionsRes, appsRes, aktifRes, pengajuanRes, lojiRes] =
    await Promise.all([
      supabase
        .from("auctions")
        .select(
          "id,clue_category,clue_name_masked,normal_price,deal_price,set_price,status",
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("merchant_applications")
        .select("id,loji_name,category,owner_name,whatsapp,status,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("auctions")
        .select("id", { count: "exact", head: true })
        .in("status", ["kumpul", "tebak", "jeda", "final"]),
      supabase
        .from("merchant_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("merchants").select("id", { count: "exact", head: true }),
    ]);

  return {
    auctions: (auctionsRes.data as AdminAuction[]) ?? [],
    applications: (appsRes.data as AdminApplication[]) ?? [],
    counts: {
      auctionsAktif: aktifRes.count ?? 0,
      pengajuan: pengajuanRes.count ?? 0,
      loji: lojiRes.count ?? 0,
    },
  };
}

export type AdminArticle = {
  slug: string;
  title: string;
  tag: string;
  published_at: string | null;
};

export async function getAdminArticles(): Promise<AdminArticle[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("articles")
      .select("slug,title,tag,published_at")
      .order("created_at", { ascending: false });
    return (data as AdminArticle[]) ?? [];
  } catch {
    return [];
  }
}

export type PakhuisData = {
  name: string;
  balance: number;
  level: string;
  stamps: number;
  vouchers: { id: string; title: string; note: string | null; status: string }[];
  ledger: { amount: number; kind: string; note: string | null; created_at: string }[];
  isSaudagar: boolean;
};

export async function getPakhuis(): Promise<PakhuisData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [walletRes, profileRes, vouchersRes, lapakRes, ledgerRes] =
    await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("profiles")
        .select("level,stamps,full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("vouchers")
        .select("id,title,note,status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("merchants")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id),
      supabase
        .from("wallet_transactions")
        .select("amount,kind,note,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    name:
      profileRes.data?.full_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "Saudagar",
    balance: walletRes.data?.balance ?? 0,
    level: profileRes.data?.level ?? "pelanggan_kecil",
    stamps: profileRes.data?.stamps ?? 0,
    vouchers: vouchersRes.data ?? [],
    ledger: ledgerRes.data ?? [],
    isSaudagar: (lapakRes.count ?? 0) > 0,
  };
}
