"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tebakLelang } from "@/app/actions/lelang";
import { BangKongsi, type GerakBang } from "./BangKongsi";
import { LiveDot } from "./Pill";
import { formatKeping } from "@/lib/utils";
import type { AuctionPublic } from "@/lib/queries";
import type { SlideData } from "@/lib/domain/slide";

type Slide = {
  t: "brand" | "produk" | "fungsi" | "pemicu" | "clue" | "tvc" | "fasilitas" | "harga" | "menang";
  key?: string; // kunci suara di slides.suara
  teks?: string;
  gambar?: string;
  url?: string; // untuk tvc
  narasi: string; // teks gelembung + fallback Web Speech
  dur: number; // ms (tvc diabaikan → ikut video)
};

const GERAK: Record<Slide["t"], GerakBang> = {
  brand: "lambai", produk: "tunjuk", fungsi: "bisik", pemicu: "palu",
  clue: "tunjuk", tvc: "nonton", fasilitas: "tunjuk", harga: "palu", menang: "menang",
};
const SUARA_KEY = "kongsi.lelang.suara";

function buildSlides(a: AuctionPublic, s: SlideData | null): Slide[] {
  if (a.revealed_price != null) return [{ t: "menang", narasi: "Dan pemenangnya sudah kita dapatkan. Selamat!", dur: 8000 }];
  const brand = a.merchant_name ?? "lapak mitra";
  const produk = a.product_name ?? a.clue_category;
  const out: Slide[] = [
    { t: "brand", key: "brand", narasi: `Kenalin, ${brand}.${s?.brandTagline ? " " + s.brandTagline : ""}`, dur: 4500 },
    { t: "produk", key: "produk", narasi: `Hari ini: ${produk}.`, dur: 4500 },
  ];
  if (s?.fungsi) out.push({ t: "fungsi", key: "fungsi", teks: s.fungsi, narasi: s.fungsi, dur: 6500 });
  if (s?.pemicu) out.push({ t: "pemicu", key: "pemicu", teks: s.pemicu, narasi: s.pemicu, dur: 6500 });
  (s?.clues ?? []).forEach((c, i) => {
    if (c.teks || c.gambar) out.push({ t: "clue", key: `clue${i}`, teks: c.teks, gambar: c.gambar, narasi: c.teks || "", dur: 5500 });
  });
  (s?.videos ?? []).forEach((url) => out.push({ t: "tvc", url, narasi: "", dur: 0 }));
  if (a.facilities.length) out.push({ t: "fasilitas", narasi: "Semua ini kamu dapat kalau menang!", dur: 5500 });
  out.push({ t: "harga", key: "harga", narasi: `Harga aslinya ${formatKeping(a.normal_price)}. Di lelang ini bisa jauh lebih murah!`, dur: 5200 });
  return out;
}

export function SlideLelang({
  auction,
  userId,
  initialGuess,
  onSkip,
  hasOther,
}: {
  auction: AuctionPublic;
  userId: string | null;
  initialGuess: number | null;
  onSkip?: () => void;
  hasOther?: boolean;
}) {
  const slides = useMemo(() => buildSlides(auction, auction.slides), [auction]);
  const n = slides.length;
  const [i, setI] = useState(0);
  const [suara, setSuara] = useState(false);
  const [bicara, setBicara] = useState(false);

  // aksi tebak/ikut
  const [guess, setGuess] = useState<number | null>(initialGuess);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuara(localStorage.getItem(SUARA_KEY) === "1");
    } catch { /* abaikan */ }
  }, []);

  const cur = slides[Math.min(i, n - 1)] ?? slides[0];
  const lanjut = useCallback(() => setI((x) => (x + 1) % n), [n]);

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

  // Pindah slide → timer + suara (tvc menunggu video).
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    mainkanSuara(cur.narasi, cur.key ? auction.slides?.suara?.[cur.key] : null);
    if (cur.t !== "tvc" && n > 1) timer.current = window.setTimeout(lanjut, cur.dur);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n]);

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
    } else {
      // nyalakan → langsung bacakan slide sekarang
      mainkanSuaraSekarang();
    }
  }
  function mainkanSuaraSekarang() {
    const url = cur.key ? auction.slides?.suara?.[cur.key] : null;
    // panggil di microtask supaya state `suara` sudah true
    setTimeout(() => {
      const teks = cur.narasi;
      if (url) { const el = new Audio(url); audioRef.current = el; el.onplay = () => setBicara(true); el.onended = () => setBicara(false); el.play().catch(() => {}); }
      else if (teks && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(teks); u.lang = "id-ID"; u.onstart = () => setBicara(true); u.onend = () => setBicara(false); window.speechSynthesis.speak(u); }
    }, 0);
  }

  const open = auction.status === "kumpul" || auction.status === "tebak";
  const decided = auction.revealed_price != null;
  const iWon = Boolean(userId && auction.hak_user_id && auction.hak_user_id === userId);

  async function kirimTebak(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const val = Number(String(new FormData(e.currentTarget).get("guess") ?? "").replace(/\D/g, ""));
    if (!val) { setErr("Isi tebakan harga."); return; }
    setBusy(true); setErr(null);
    const { error } = await tebakLelang(auction.id, val);
    setBusy(false);
    if (error) setErr(error);
    else { setGuess(val); setEditing(false); }
  }

  const narasi = cur.narasi;

  return (
    <div className="relative mx-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden rounded-[10px] border-2 border-kongsi-ink bg-gradient-to-b from-kongsi-indigo to-kongsi-indigo-dark shadow-hard">
      {/* progress bar ala stories */}
      <div className="absolute inset-x-0 top-0 z-30 flex gap-[3px] p-2">
        {slides.map((_, k) => (
          <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-kongsi-parchment/25">
            <span className={`block h-full bg-kongsi-beeswax ${k < i ? "w-full" : k === i ? "sl-progress" : "w-0"}`} style={k === i && cur.t !== "tvc" ? { animationDuration: `${cur.dur}ms` } : undefined} />
          </span>
        ))}
      </div>

      {/* badge live + peserta + suara */}
      <div className="absolute left-3 top-4 z-30 flex items-center gap-2">
        <span className="inline-flex items-center gap-[5px] rounded-full border-2 border-kongsi-ink bg-kongsi-grenadine px-2 py-[2px] text-[10px] font-black uppercase tracking-[1px] text-kongsi-parchment"><LiveDot live /> Live</span>
        <span className="rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/90 px-2 py-[2px] text-[10px] font-bold text-kongsi-ink">👥 {auction.peserta_count}/{auction.capacity}</span>
      </div>
      <button type="button" onClick={toggleSuara} aria-label={suara ? "Senyapkan" : "Nyalakan suara"} className="absolute right-3 top-4 z-30 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/95 px-[10px] py-[5px] text-[12px] font-bold text-kongsi-ink shadow-hard-sm">
        {suara ? "🔊" : "🔇 Suara"}
      </button>

      {/* ISI SLIDE (mengisi) */}
      <div className="relative flex-1">
        <div key={i} className="sl-enter absolute inset-0 flex flex-col items-center justify-center px-7 pb-[132px] pt-16 text-center text-kongsi-parchment">
          {cur.t === "brand" ? (
            <>
              {auction.merchant_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auction.merchant_logo} alt="" className="sl-pop mb-3 h-16 w-16 rounded-full border-2 border-kongsi-beeswax object-cover" />
              ) : <div className="sl-pop mb-3 text-3xl">🏪</div>}
              <div className="text-[11px] font-bold uppercase tracking-[3px] text-kongsi-beeswax">Dipersembahkan oleh</div>
              <div className="sl-drop mt-1 font-fraunces text-[30px] font-black leading-tight">{auction.merchant_name ?? "Lapak Mitra"}</div>
              {auction.slides?.brandTagline ? <div className="sl-rise mt-2 text-sm opacity-90">{auction.slides.brandTagline}</div> : null}
            </>
          ) : cur.t === "produk" ? (
            <>
              <div className="text-[11px] font-bold uppercase tracking-[3px] text-kongsi-beeswax">Yang dilelang</div>
              <div className="sl-drop mt-2 font-fraunces text-[32px] font-black leading-tight">{auction.product_name ?? auction.clue_category}</div>
              <div className="sl-rise mt-2 text-sm opacity-80">dari {auction.merchant_name}</div>
            </>
          ) : cur.t === "fungsi" ? (
            <>
              <div className="text-4xl">💡</div>
              <div className="sl-rise mt-4 font-fraunces text-[23px] font-black leading-snug">{cur.teks}</div>
            </>
          ) : cur.t === "pemicu" ? (
            <>
              <div className="text-4xl">⏳</div>
              <div className="sl-rise mt-4 font-fraunces text-[23px] font-black leading-snug text-kongsi-beeswax">{cur.teks}</div>
            </>
          ) : cur.t === "clue" ? (
            <>
              <div className="rounded-full border-2 border-kongsi-beeswax px-3 py-1 text-[11px] font-black uppercase tracking-[2px] text-kongsi-beeswax">Keunggulan</div>
              {cur.gambar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.gambar} alt="" className="sl-pop mt-4 max-h-[180px] rounded-[6px] border-2 border-kongsi-ink object-cover" />
              ) : null}
              {cur.teks ? <div className="sl-rise mt-4 font-fraunces text-[22px] font-black leading-snug">{cur.teks}</div> : null}
            </>
          ) : cur.t === "tvc" ? (
            <video ref={videoRef} key={cur.url} src={cur.url} className="absolute inset-0 h-full w-full object-cover" autoPlay muted={!suara} playsInline preload="auto" onEnded={lanjut} />
          ) : cur.t === "fasilitas" ? (
            <>
              <div className="font-fraunces text-lg font-black text-kongsi-beeswax">Yang kamu dapat</div>
              <ul className="mt-4 space-y-2 text-left">
                {auction.facilities.map((f, k) => (
                  <li key={f} className="sl-stagger flex items-start gap-2 text-[15px]" style={{ animationDelay: `${k * 150}ms` }}><span className="text-kongsi-beeswax">◆</span><span>{f}</span></li>
                ))}
              </ul>
            </>
          ) : cur.t === "harga" ? (
            <>
              <div className="text-[13px] opacity-80">Harga aslinya</div>
              <div className="relative mt-1 inline-block font-fraunces text-[40px] font-black text-kongsi-beeswax">
                {formatKeping(auction.normal_price)}
                <span className="sl-strike absolute left-0 top-1/2 h-[4px] w-full bg-kongsi-grenadine" />
              </div>
              <div className="sl-shake mt-5 font-fraunces text-xl font-black">Di lelang ini, kamu bisa dapat jauh lebih murah 👀</div>
            </>
          ) : (
            <>
              <div className="font-fraunces text-[26px] font-black text-kongsi-beeswax">🎉 Pemenang!</div>
              <div className="mt-2 text-sm opacity-90">{auction.winner_name ?? "—"}</div>
              <div className="mt-5 flex justify-center gap-5 text-center">
                <div><div className="text-[10px] uppercase tracking-wide text-kongsi-beeswax">Tebakan</div><div className="font-fraunces text-lg font-black">{auction.winning_guess != null ? formatKeping(auction.winning_guess) : "—"}</div></div>
                <div><div className="text-[10px] uppercase tracking-wide text-kongsi-beeswax">Harga asli</div><div className="font-fraunces text-lg font-black">{auction.revealed_price != null ? formatKeping(auction.revealed_price) : "—"}</div></div>
              </div>
            </>
          )}
        </div>

        {/* navigasi slide */}
        {n > 1 ? (
          <>
            <button type="button" onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Sebelumnya" className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/85 px-[9px] py-[5px] text-[14px] font-black text-kongsi-ink">‹</button>
            <button type="button" onClick={lanjut} aria-label="Berikutnya" className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/85 px-[9px] py-[5px] text-[14px] font-black text-kongsi-ink">›</button>
          </>
        ) : null}

        {/* Bang Kongsi + gelembung */}
        {narasi ? (
          <div className="absolute bottom-[112px] left-[94px] z-20 max-w-[200px] rounded-[12px] border-2 border-kongsi-ink bg-kongsi-parchment px-3 py-[6px] text-[12px] font-semibold leading-snug text-kongsi-ink shadow-hard-sm">
            {narasi}
          </div>
        ) : null}
        <div className="pointer-events-none absolute -bottom-1 left-0 z-20"><BangKongsi gerak={GERAK[cur.t]} bicara={bicara} size={118} /></div>
      </div>

      {/* ===== BAR AKSI (menempel di bawah bingkai) ===== */}
      <div className="relative z-30 border-t-2 border-kongsi-ink bg-kongsi-parchment px-3 py-[10px]">
        {decided ? (
          iWon ? (
            <a href={`/lelang/bayar/${auction.id}`} className="block rounded-[4px] border-2 border-kongsi-ink bg-kongsi-grenadine py-[11px] text-center font-fraunces text-[15px] font-black text-kongsi-parchment shadow-hard-sm">
              🏆 Kamu menang! Bayar sekarang →
            </a>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-kongsi-ink">Lelang selesai.</span>
              {hasOther ? <button type="button" onClick={onSkip} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-2 text-[13px] font-bold">Lihat lelang lain →</button> : null}
            </div>
          )
        ) : !userId ? (
          <a href="/masuk" className="block rounded-[4px] border-2 border-kongsi-ink bg-kongsi-grenadine py-[11px] text-center font-fraunces text-[15px] font-black text-kongsi-parchment shadow-hard-sm">
            Masuk untuk Ikut Lelang
          </a>
        ) : !open ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-kongsi-ink">Fase {auction.status} — pantau terus.</span>
            {hasOther ? <button type="button" onClick={onSkip} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-2 text-[13px] font-bold">Lelang lain →</button> : null}
          </div>
        ) : guess && !editing ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-kongsi-ok">✓ Tebakanmu: {formatKeping(guess)}</span>
            <button type="button" onClick={() => setEditing(true)} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-2 text-[13px] font-bold">Ubah</button>
          </div>
        ) : (
          <form onSubmit={kirimTebak} className="flex items-center gap-2">
            <div className="flex flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-white">
              <span className="flex items-center bg-kongsi-indigo px-[10px] text-[13px] font-bold text-kongsi-parchment">Rp</span>
              <input name="guess" inputMode="numeric" autoFocus={editing} defaultValue={guess ? guess.toLocaleString("id-ID") : ""} placeholder="tebak harga tebus" className="w-full px-2 py-2 font-fraunces text-lg font-black outline-none" />
            </div>
            <button type="submit" disabled={busy} className="shrink-0 rounded-[4px] border-2 border-kongsi-ink bg-kongsi-grenadine px-4 py-[9px] font-fraunces text-[14px] font-black text-kongsi-parchment shadow-hard-sm disabled:opacity-60">
              {busy ? "…" : "Ikut & Tebak"}
            </button>
          </form>
        )}
        {err ? <p className="mt-1 text-[12px] font-bold text-kongsi-bad">{err}</p> : null}
        {!decided && open && userId && !guess && hasOther ? (
          <button type="button" onClick={onSkip} className="mt-1 w-full text-center text-[12px] font-bold text-kongsi-ink-soft underline">gak dulu — lihat lelang produk lain →</button>
        ) : null}
      </div>
    </div>
  );
}
