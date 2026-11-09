"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BangKongsi, type GerakBang } from "./BangKongsi";
import { LiveDot } from "./Pill";
import { formatKeping } from "@/lib/utils";
import type { AuctionPublic } from "@/lib/queries";
import type { SlideData } from "@/lib/domain/slide";

type Slide =
  | { t: "pembuka" }
  | { t: "clue"; teks: string; gambar?: string; audio?: string | null }
  | { t: "tvc"; url: string }
  | { t: "fasilitas" }
  | { t: "tebak"; audio?: string | null }
  | { t: "menang" };

const DURASI: Record<Slide["t"], number> = {
  pembuka: 5200, clue: 6000, tvc: 30000, fasilitas: 6000, tebak: 7000, menang: 8000,
};
const GERAK: Record<Slide["t"], GerakBang> = {
  pembuka: "lambai", clue: "tunjuk", tvc: "nonton", fasilitas: "tunjuk", tebak: "palu", menang: "menang",
};
const SUARA_KEY = "kongsi.lelang.suara";

function buildSlides(a: AuctionPublic, s: SlideData | null): Slide[] {
  if (a.revealed_price != null) return [{ t: "menang" }];
  const out: Slide[] = [{ t: "pembuka" }];
  const clues = s?.clues ?? [];
  clues.forEach((c, i) =>
    out.push({ t: "clue", teks: c.teks, gambar: c.gambar, audio: s?.suara?.clues?.[i] ?? null }),
  );
  (s?.videos ?? []).forEach((url) => out.push({ t: "tvc", url }));
  if (a.facilities.length) out.push({ t: "fasilitas" });
  out.push({ t: "tebak", audio: s?.suara?.tebak ?? null });
  return out;
}

export function SlideLelang({ auction }: { auction: AuctionPublic }) {
  const slides = useMemo(() => buildSlides(auction, auction.slides), [auction]);
  const [i, setI] = useState(0);
  const [suara, setSuara] = useState(false);
  const [bicara, setBicara] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      // Baca preferensi suara setelah mount (hindari mismatch hydration).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuara(localStorage.getItem(SUARA_KEY) === "1");
    } catch { /* abaikan */ }
  }, []);

  const n = slides.length;
  const cur = slides[Math.min(i, n - 1)] ?? slides[0];

  const lanjut = useCallback(() => setI((x) => (x + 1) % n), [n]);

  // Suara per slide: pakai mp3 ElevenLabs bila ada, jika tidak Web Speech API.
  const mainkanSuara = useCallback(
    (teks: string, url: string | null | undefined) => {
      if (!suara) return;
      try { window.speechSynthesis?.cancel(); } catch { /* */ }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (url) {
        const el = new Audio(url);
        audioRef.current = el;
        el.onplay = () => setBicara(true);
        el.onended = () => setBicara(false);
        el.onerror = () => setBicara(false);
        el.play().catch(() => setBicara(false));
      } else if (teks && typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(teks);
        u.lang = "id-ID";
        u.onstart = () => setBicara(true);
        u.onend = () => setBicara(false);
        window.speechSynthesis.speak(u);
      }
    },
    [suara],
  );

  const ucapan = useCallback(
    (sl: Slide): { teks: string; audio: string | null } => {
      switch (sl.t) {
        case "pembuka":
          return { teks: `Lelang kali ini: ${auction.product_name ?? auction.clue_category} dari ${auction.merchant_name ?? "lapak mitra"}. Ayo ikut!`, audio: auction.slides?.suara?.pembuka ?? null };
        case "clue":
          return { teks: sl.teks, audio: sl.audio ?? null };
        case "tvc":
          return { teks: "Kita tonton dulu videonya ya!", audio: null };
        case "fasilitas":
          return { teks: "Semua ini kamu dapat kalau menang!", audio: null };
        case "tebak":
          return { teks: "Sekarang tebak harganya. Yang paling dekat, menang!", audio: sl.audio ?? null };
        case "menang":
          return { teks: "Dan pemenangnya sudah kita dapatkan. Selamat!", audio: null };
      }
    },
    [auction],
  );

  // Pindah slide: atur timer (kecuali TVC yang menunggu video) + mainkan suara.
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const u = ucapan(cur);
    mainkanSuara(u.teks, u.audio);
    if (cur.t !== "tvc" && n > 1) {
      timer.current = window.setTimeout(lanjut, DURASI[cur.t]);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

  // Saat slide TVC: muat & putar video; onEnded → lanjut.
  useEffect(() => {
    if (cur.t !== "tvc") return;
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => undefined);
  }, [i, cur]);

  function toggleSuara() {
    const next = !suara;
    setSuara(next);
    try { localStorage.setItem(SUARA_KEY, next ? "1" : "0"); } catch { /* */ }
    if (!next) {
      try { window.speechSynthesis?.cancel(); } catch { /* */ }
      if (audioRef.current) audioRef.current.pause();
      setBicara(false);
    }
  }

  const u = ucapan(cur);

  return (
    <div className="mx-auto w-full max-w-[460px]">
      {/* progress bar ala stories */}
      <div className="mb-2 flex gap-[3px]">
        {slides.map((_, k) => (
          <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-kongsi-parchment/30">
            <span
              className={`block h-full bg-kongsi-beeswax ${k < i ? "w-full" : k === i ? "sl-progress" : "w-0"}`}
              style={k === i && cur.t !== "tvc" ? { animationDuration: `${DURASI[cur.t]}ms` } : undefined}
            />
          </span>
        ))}
      </div>

      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[8px] border-2 border-kongsi-ink bg-gradient-to-br from-kongsi-indigo to-kongsi-indigo-dark">
        {/* badge live + peserta */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <span className="inline-flex items-center gap-[5px] rounded-full border-2 border-kongsi-ink bg-kongsi-grenadine px-2 py-[2px] text-[10px] font-black uppercase tracking-[1px] text-kongsi-parchment">
            <LiveDot live /> Live
          </span>
          <span className="rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/90 px-2 py-[2px] text-[10px] font-bold text-kongsi-ink">
            👥 {auction.peserta_count}/{auction.capacity}
          </span>
        </div>
        {/* tombol suara */}
        <button
          type="button"
          onClick={toggleSuara}
          aria-label={suara ? "Senyapkan" : "Nyalakan suara"}
          className="absolute right-3 top-3 z-20 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/95 px-[10px] py-[5px] text-[12px] font-bold text-kongsi-ink shadow-hard-sm"
        >
          {suara ? "🔊" : "🔇 Suara"}
        </button>

        {/* ISI SLIDE */}
        <div key={i} className="sl-enter absolute inset-0 flex flex-col items-center justify-center px-6 py-12 text-center text-kongsi-parchment">
          {cur.t === "pembuka" ? (
            <>
              <div className="font-fraunces text-sm italic text-kongsi-beeswax">Balai Lelang · {auction.type === "vendu" ? "Lelang Khusus" : "Reguler"}</div>
              <div className="sl-drop mt-2 font-fraunces text-[30px] font-black leading-tight">{auction.product_name ?? auction.clue_category}</div>
              <div className="mt-2 text-sm opacity-90">
                dari <b className="font-fraunces tracking-wide text-kongsi-beeswax">{auction.merchant_name ?? "lapak mitra"}</b>
              </div>
              <div className="mt-4 text-[13px] opacity-80">Harga normal</div>
              <div className="font-fraunces text-2xl font-black text-kongsi-beeswax line-through">{formatKeping(auction.normal_price)}</div>
            </>
          ) : cur.t === "clue" ? (
            <>
              <div className="rounded-full border-2 border-kongsi-beeswax px-3 py-1 text-[11px] font-black uppercase tracking-[2px] text-kongsi-beeswax">Clue</div>
              {cur.gambar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.gambar} alt="" className="sl-pop mt-4 max-h-[150px] rounded-[6px] border-2 border-kongsi-ink object-cover" />
              ) : null}
              <div className="sl-rise mt-4 font-fraunces text-[22px] font-black leading-snug">{cur.teks}</div>
            </>
          ) : cur.t === "tvc" ? (
            <video
              ref={videoRef}
              key={cur.url}
              src={cur.url}
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted={!suara}
              playsInline
              preload="auto"
              onEnded={lanjut}
            />
          ) : cur.t === "fasilitas" ? (
            <>
              <div className="font-fraunces text-lg font-black text-kongsi-beeswax">Yang kamu dapat</div>
              <ul className="mt-4 space-y-2 text-left">
                {auction.facilities.map((f, k) => (
                  <li key={f} className="sl-stagger flex items-start gap-2 text-[15px]" style={{ animationDelay: `${k * 160}ms` }}>
                    <span className="text-kongsi-beeswax">◆</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : cur.t === "tebak" ? (
            <>
              <div className="font-fraunces text-[26px] font-black leading-tight">Tebak harganya!</div>
              <div className="mt-3 text-[13px] opacity-80">Harga normal</div>
              <div className="relative inline-block font-fraunces text-3xl font-black text-kongsi-beeswax">
                {formatKeping(auction.normal_price)}
                <span className="sl-strike absolute left-0 top-1/2 h-[3px] w-full bg-kongsi-grenadine" />
              </div>
              <div className="sl-shake mt-4 font-fraunces text-xl font-black text-kongsi-parchment">Berapa harga tebusnya? 🤔</div>
            </>
          ) : (
            <>
              <div className="font-fraunces text-[26px] font-black text-kongsi-beeswax">🎉 Pemenang!</div>
              <div className="mt-2 text-sm opacity-90">{auction.winner_name ?? "—"}</div>
              <div className="mt-4 text-[13px] opacity-80">Harga asli</div>
              <div className="font-fraunces text-3xl font-black text-kongsi-beeswax">{auction.revealed_price != null ? formatKeping(auction.revealed_price) : "—"}</div>
            </>
          )}
        </div>

        {/* Bang Kongsi + gelembung */}
        <div className="absolute bottom-0 left-0 z-20 flex items-end">
          {u.teks ? (
            <div className="mb-[76px] ml-2 max-w-[180px] rounded-[10px] border-2 border-kongsi-ink bg-kongsi-parchment px-3 py-[6px] text-[11px] font-semibold text-kongsi-ink shadow-hard-sm">
              {u.teks}
            </div>
          ) : null}
        </div>
        <div className="pointer-events-none absolute -bottom-2 left-1 z-10">
          <BangKongsi gerak={GERAK[cur.t]} bicara={bicara} size={120} />
        </div>

        {/* navigasi */}
        {n > 1 ? (
          <>
            <button type="button" onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Slide sebelumnya" className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/90 px-[9px] py-[5px] text-[14px] font-black text-kongsi-ink">‹</button>
            <button type="button" onClick={lanjut} aria-label="Slide berikutnya" className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/90 px-[9px] py-[5px] text-[14px] font-black text-kongsi-ink">›</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
