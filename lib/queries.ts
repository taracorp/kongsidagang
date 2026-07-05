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
      };
    }
  } catch {
    // fallback
  }
  return dummyGetMerchant(slug) ?? null;
}

export async function getFeatured(): Promise<{ etalase: Produk[]; pilihan: Produk[] }> {
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
};

export async function getActiveAuction(
  type: "reguler" | "vendu" = "reguler",
): Promise<AuctionPublic | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("auction_items_public")
      .select(
        "id,type,clue_category,clue_name_masked,normal_price,facilities,status,capacity",
      )
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
      .select(
        "id,type,clue_category,clue_name_masked,normal_price,facilities,status,capacity",
      )
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

export type PakhuisData = {
  name: string;
  balance: number;
  level: string;
  stamps: number;
  vouchers: { title: string; note: string }[];
};

export async function getPakhuis(): Promise<PakhuisData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [walletRes, profileRes, vouchersRes] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("level,stamps,full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("vouchers")
      .select("title,note")
      .eq("user_id", user.id)
      .eq("status", "aktif")
      .order("created_at"),
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
  };
}
