"use client";

import { useEffect, useRef, useState } from "react";

// Carousel TVC vertikal (9:16) di panggung lelang. Autoplay + muted + inline supaya lolos
// kebijakan autoplay mobile; berganti ke video berikutnya saat `onEnded`, kembali ke 0 di
// akhir daftar. Tombol suara (muted/unmuted) & navigasi manual ‹ ›. Preload video berikutnya.
export function TvcCarousel({ urls }: { urls: string[] }) {
  const n = urls.length;
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Saat `idx` berubah, muat & putar ulang dari awal (muted autoplay sudah legal).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    const p = v.play();
    if (p && typeof p.then === "function") p.catch(() => undefined);
  }, [idx]);

  if (n === 0) return null;
  const next = () => setIdx((i) => (i + 1) % n);
  const prev = () => setIdx((i) => (i - 1 + n) % n);

  return (
    <div className="mx-auto mb-7 w-full max-w-[360px]">
      <div className="text-[11px] font-bold uppercase tracking-[2px] text-kongsi-olive">
        ✦ Pariwara Lelang
      </div>
      <div className="relative mt-[6px] overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-black shadow-hard">
        <video
          ref={videoRef}
          key={urls[idx]}
          className="block aspect-[9/16] w-full object-cover"
          src={urls[idx]}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          onEnded={next}
          controls={false}
        />
        {/* pre-fetch video berikutnya supaya transisi mulus */}
        {n > 1 ? <link rel="preload" as="video" href={urls[(idx + 1) % n]} /> : null}

        {/* Toggle suara */}
        <button
          type="button"
          onClick={() => {
            setMuted((m) => !m);
            const v = videoRef.current;
            if (v) v.muted = !v.muted;
          }}
          aria-label={muted ? "Hidupkan suara" : "Senyapkan"}
          className="absolute right-2 top-2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/95 px-[10px] py-[6px] text-[12px] font-bold text-kongsi-ink shadow-hard-sm"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        {/* Navigasi manual bila lebih dari 1 TVC */}
        {n > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="TVC sebelumnya"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/95 px-[10px] py-[6px] text-[14px] font-black text-kongsi-ink shadow-hard-sm"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="TVC berikutnya"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment/95 px-[10px] py-[6px] text-[14px] font-black text-kongsi-ink shadow-hard-sm"
            >
              ›
            </button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-[6px]">
              {urls.map((_, i) => (
                <span
                  key={i}
                  className={`h-[6px] w-[6px] rounded-full border border-kongsi-ink ${i === idx ? "bg-kongsi-grenadine" : "bg-kongsi-parchment/70"}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
