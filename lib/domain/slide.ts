// Bentuk materi slide panggung lelang (dipakai Auction.slides & AuctionUsulan.slides).
// Hanya berisi teks/URL publik — TIDAK pernah memuat harga rahasia (deal/set).
// Alur bercerita (Ch 8.53): brand → produk → fungsi/masalah → pemicu → clue → video → fasilitas → harga → ajak.

export type SlideClue = { teks: string; gambar?: string };

/** URL suara per bagian cerita. Kunci: brand, produk, fungsi, pemicu, clue0.., harga, tebak. */
export type SlideSuara = Record<string, string | null>;

export type SlideData = {
  brandTagline?: string; // satu kalimat tentang lapak/brand (opsional)
  fungsi?: string; // masalah yang diatasi — "Buat kamu yang sering kusam…"
  pemicu?: string; // pemicu/urgency — "Jangan tunggu makin parah…"
  clues: SlideClue[]; // keunggulan tambahan 0..3
  videos: string[]; // 0..3 URL /uploads/lelang/...
  fasilitas: string[]; // 0..8
  suara?: SlideSuara;
};

export const SLIDE_MAKS = { clue: 3, clueLen: 120, video: 3, fasilitas: 8, fasilitasLen: 80, narasiLen: 160 };

/** Hanya izinkan URL hasil unggahan kita sendiri (anti-SSRF / konten luar). */
export function urlUploadLelang(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const s = u.trim();
  return /^\/uploads\/lelang\/[\w./-]+$/.test(s) ? s : null;
}

function teksPendek(v: unknown, maks: number): string {
  return String(v ?? "").trim().slice(0, maks);
}

/** Bersihkan & validasi input slide dari form (lapak/admin). Melempar Error bila melanggar. */
export function sanitizeSlides(input: unknown): SlideData {
  const o = (input ?? {}) as Record<string, unknown>;
  const cluesRaw = Array.isArray(o.clues) ? o.clues : [];
  const clues: SlideClue[] = cluesRaw
    .slice(0, SLIDE_MAKS.clue)
    .map((c) => {
      const cc = (c ?? {}) as Record<string, unknown>;
      const teks = teksPendek(cc.teks, SLIDE_MAKS.clueLen);
      const gambar = urlUploadLelang(cc.gambar) ?? undefined;
      return { teks, ...(gambar ? { gambar } : {}) };
    })
    .filter((c) => c.teks.length > 0 || c.gambar);

  const videos = (Array.isArray(o.videos) ? o.videos : [])
    .map((v) => urlUploadLelang(v))
    .filter((v): v is string => Boolean(v))
    .slice(0, SLIDE_MAKS.video);

  const fasilitas = (Array.isArray(o.fasilitas) ? o.fasilitas : [])
    .map((f) => teksPendek(f, SLIDE_MAKS.fasilitasLen))
    .filter(Boolean)
    .slice(0, SLIDE_MAKS.fasilitas);

  const fungsi = teksPendek(o.fungsi, SLIDE_MAKS.narasiLen);
  const pemicu = teksPendek(o.pemicu, SLIDE_MAKS.narasiLen);
  const brandTagline = teksPendek(o.brandTagline, SLIDE_MAKS.narasiLen);

  if (!fungsi && clues.length === 0 && videos.length === 0) {
    throw new Error("Isi minimal bagian 'fungsi/masalah', satu clue, atau satu video.");
  }
  return {
    ...(brandTagline ? { brandTagline } : {}),
    ...(fungsi ? { fungsi } : {}),
    ...(pemicu ? { pemicu } : {}),
    clues,
    videos,
    fasilitas,
  };
}

/** Baca slides dari kolom Json DB menjadi SlideData yang aman (tanpa throw). */
export function parseSlides(value: unknown): SlideData | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const clues = Array.isArray(o.clues)
    ? (o.clues as unknown[]).map((c) => {
        const cc = (c ?? {}) as Record<string, unknown>;
        return { teks: String(cc.teks ?? ""), ...(typeof cc.gambar === "string" ? { gambar: cc.gambar } : {}) };
      })
    : [];
  const videos = Array.isArray(o.videos) ? (o.videos as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const fasilitas = Array.isArray(o.fasilitas) ? (o.fasilitas as unknown[]).filter((v): v is string => typeof v === "string") : [];
  return {
    brandTagline: typeof o.brandTagline === "string" ? o.brandTagline : undefined,
    fungsi: typeof o.fungsi === "string" ? o.fungsi : undefined,
    pemicu: typeof o.pemicu === "string" ? o.pemicu : undefined,
    clues,
    videos,
    fasilitas,
    suara: (o.suara ?? undefined) as SlideSuara | undefined,
  };
}
