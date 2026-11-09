// Bentuk materi slide panggung lelang (dipakai Auction.slides & AuctionUsulan.slides).
// Hanya berisi teks/URL publik — TIDAK pernah memuat harga rahasia (deal/set).

export type SlideClue = { teks: string; gambar?: string };

export type SlideSuara = {
  pembuka?: string | null; // URL mp3 sapaan + nama produk
  clues?: (string | null)[]; // URL mp3 per clue
  tebak?: string | null; // URL mp3 ajakan menebak
};

export type SlideData = {
  clues: SlideClue[]; // 0..3
  videos: string[]; // 0..3 URL /uploads/lelang/...
  fasilitas: string[]; // 0..8
  suara?: SlideSuara;
};

export const SLIDE_MAKS = { clue: 3, clueLen: 120, video: 3, fasilitas: 8, fasilitasLen: 80 };

/** Hanya izinkan URL hasil unggahan kita sendiri (anti-SSRF / konten luar). */
export function urlUploadLelang(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const s = u.trim();
  return /^\/uploads\/lelang\/[\w./-]+$/.test(s) ? s : null;
}

/** Bersihkan & validasi input slide dari form (lapak/admin). Melempar Error bila melanggar. */
export function sanitizeSlides(input: unknown): SlideData {
  const o = (input ?? {}) as Record<string, unknown>;
  const cluesRaw = Array.isArray(o.clues) ? o.clues : [];
  const clues: SlideClue[] = cluesRaw
    .slice(0, SLIDE_MAKS.clue)
    .map((c) => {
      const cc = (c ?? {}) as Record<string, unknown>;
      const teks = String(cc.teks ?? "").trim().slice(0, SLIDE_MAKS.clueLen);
      const gambar = urlUploadLelang(cc.gambar) ?? undefined;
      return { teks, ...(gambar ? { gambar } : {}) };
    })
    .filter((c) => c.teks.length > 0 || c.gambar);

  const videosRaw = Array.isArray(o.videos) ? o.videos : [];
  const videos = videosRaw
    .map((v) => urlUploadLelang(v))
    .filter((v): v is string => Boolean(v))
    .slice(0, SLIDE_MAKS.video);

  const fasRaw = Array.isArray(o.fasilitas) ? o.fasilitas : [];
  const fasilitas = fasRaw
    .map((f) => String(f ?? "").trim().slice(0, SLIDE_MAKS.fasilitasLen))
    .filter(Boolean)
    .slice(0, SLIDE_MAKS.fasilitas);

  if (clues.length === 0 && videos.length === 0) {
    throw new Error("Isi minimal 1 clue atau 1 video untuk slide lelang.");
  }
  return { clues, videos, fasilitas };
}

/** Baca slides dari kolom Json DB menjadi SlideData yang aman (tanpa throw). */
export function parseSlides(value: unknown): SlideData | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const clues = Array.isArray(o.clues)
    ? (o.clues as unknown[]).map((c) => {
        const cc = (c ?? {}) as Record<string, unknown>;
        return {
          teks: String(cc.teks ?? ""),
          ...(typeof cc.gambar === "string" ? { gambar: cc.gambar } : {}),
        };
      })
    : [];
  const videos = Array.isArray(o.videos) ? (o.videos as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const fasilitas = Array.isArray(o.fasilitas) ? (o.fasilitas as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const suara = (o.suara ?? undefined) as SlideSuara | undefined;
  return { clues, videos, fasilitas, suara };
}
