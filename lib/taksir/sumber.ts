import "server-only";
import { bacaHarga, type Pembanding } from "@/lib/taksir/ekstrak";

// Sumber harga Juru Taksir — semua gratis:
// 1. BigGo (biggo.id): situs perbandingan harga, data produk dari Tokopedia/Shopee/Lazada/Blibli dll.
//    robots.txt: Allow / (kecuali /r/). Kita hanya membaca halaman pencarian /s/, dengan jeda & cache.
// 2. SearXNG self-hosted (SEARXNG_URL, default http://127.0.0.1:8888): cuplikan hasil Bing/DuckDuckGo/Yahoo.
//    Halaman marketplace TIDAK di-crawl; hanya cuplikan mesin pencari (Bagian 7).
// TAKSIR_MOCK=true → data tiruan (uji/dev tanpa jaringan).

const UA = "Mozilla/5.0 (compatible; KongsiTaksir/1.0; +https://kongsidagang.store)";
export type Mentah = Omit<Pembanding, "kondisi">;

// Jeda sopan antar permintaan ke situs luar (per proses).
let antrean: Promise<unknown> = Promise.resolve();
function bergiliran<T>(f: () => Promise<T>, jedaMs = 1500): Promise<T> {
  const jalan = antrean.then(f, f);
  antrean = jalan.then(
    () => new Promise((r) => setTimeout(r, jedaMs)),
    () => new Promise((r) => setTimeout(r, jedaMs)),
  );
  return jalan;
}

async function ambil(url: string, ms = 12_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/json", "Accept-Language": "id-ID,id;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ------------------------------------------------------------
// BigGo
// ------------------------------------------------------------

type ItemBigGo = { title?: string; price?: number; currency?: string; purl?: string; store?: { name?: string } };

/** Ambil array `"list":[...]` dari payload React Server Components halaman pencarian BigGo. */
export function uraiBigGo(html: string): Mentah[] {
  const potongan = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => {
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return "";
    }
  });
  const s = potongan.join("");
  const i = s.indexOf('"ssrData"');
  if (i < 0) return [];
  const j = s.indexOf('"list":[', i);
  if (j < 0) return [];
  const mulai = j + '"list":'.length;
  let dalam = 0;
  let akhir = -1;
  for (let k = mulai; k < s.length; k++) {
    if (s[k] === "[") dalam++;
    else if (s[k] === "]" && --dalam === 0) {
      akhir = k + 1;
      break;
    }
  }
  if (akhir < 0) return [];
  let list: ItemBigGo[] = [];
  try {
    list = JSON.parse(s.slice(mulai, akhir));
  } catch {
    return [];
  }
  return list
    .filter((x) => x.title && typeof x.price === "number" && x.price > 0 && (x.currency ?? "IDR") === "IDR" && x.purl)
    .map((x) => ({
      sumber: x.store?.name || "BigGo",
      judul: String(x.title).slice(0, 200),
      harga: Math.round(x.price!),
      url: String(x.purl),
      asal: "biggo" as const,
    }));
}

export async function cariBigGo(kueri: string): Promise<Mentah[]> {
  const html = await bergiliran(() => ambil(`https://biggo.id/s/${encodeURIComponent(kueri)}`));
  return uraiBigGo(html);
}

// ------------------------------------------------------------
// SearXNG (cuplikan mesin pencari)
// ------------------------------------------------------------

const NAMA_SITUS: Record<string, string> = {
  "tokopedia.com": "Tokopedia",
  "shopee.co.id": "Shopee",
  "lazada.co.id": "Lazada",
  "blibli.com": "Blibli",
  "bukalapak.com": "Bukalapak",
  "olx.co.id": "OLX",
  "jualo.com": "Jualo",
  "ruparupa.com": "Ruparupa",
  "biggo.id": "BigGo",
};

function namaSitus(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const kunci = Object.keys(NAMA_SITUS).find((k) => host === k || host.endsWith(`.${k}`));
    return kunci ? NAMA_SITUS[kunci] : host;
  } catch {
    return "web";
  }
}

export async function cariPencarian(kueri: string): Promise<Mentah[]> {
  const base = (process.env.SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/$/, "");
  const url = `${base}/search?format=json&language=id-ID&q=${encodeURIComponent(kueri)}`;
  const json = JSON.parse(await ambil(url, 15_000)) as { results?: { title?: string; content?: string; url?: string }[] };
  const out: Mentah[] = [];
  for (const r of json.results ?? []) {
    if (!r.url || !r.title) continue;
    const judul = r.title;
    // Pakai harga pertama di judul, kalau tidak ada di cuplikan. Hanya satu angka per hasil agar tidak bias.
    const harga = bacaHarga(judul)[0] ?? bacaHarga(r.content ?? "")[0];
    if (!harga) continue;
    out.push({ sumber: namaSitus(r.url), judul: `${judul} ${r.content ?? ""}`.slice(0, 200), harga, url: r.url, asal: "pencarian" });
  }
  return out;
}

// ------------------------------------------------------------
// Data tiruan (TAKSIR_MOCK=true)
// ------------------------------------------------------------

export function tiruan(kueri: string): Mentah[] {
  const q = kueri.toLowerCase();
  const p = (sumber: string, judul: string, harga: number, url: string): Mentah => ({ sumber, judul, harga, url, asal: "biggo" });
  if (q.includes("polytron")) {
    return [
      p("Blibli", "POLYTRON LED TV 32 Inch PLD 32T1850", 2_675_000, "https://www.blibli.com/p/a"),
      p("Tokopedia", "Polytron PLD 32T1850 LED TV 32 inch", 2_550_000, "https://www.tokopedia.com/a"),
      p("Shopee", "TV Polytron 32 inch PLD 32T1850 garansi resmi", 2_600_000, "https://shopee.co.id/a"),
      p("Shopee", "TV Polytron 32 inch PLD 32T1850 bekas mulus", 1_450_000, "https://shopee.co.id/b"),
      p("Tokopedia", "Polytron 32T1850 second normal", 1_350_000, "https://www.tokopedia.com/b"),
      p("OLX", "TV Polytron PLD 32T1850 32 inch", 1_300_000, "https://www.olx.co.id/item/a"),
      p("Lazada", "Backlight TV POLYTRON 32 Inch PLD-32T1850", 90_000, "https://www.lazada.co.id/a"),
    ];
  }
  if (q.includes("vespa")) {
    return [
      p("OLX", "Vespa Super 1978 klasik", 28_000_000, "https://www.olx.co.id/item/v1"),
      p("OLX", "Vespa Super 1978 orisinil", 32_000_000, "https://www.olx.co.id/item/v2"),
      p("Jualo", "Vespa Super 1978 bekas surat lengkap", 30_000_000, "https://www.jualo.com/v3"),
    ];
  }
  return [];
}
