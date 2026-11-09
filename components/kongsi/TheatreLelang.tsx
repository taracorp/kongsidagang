"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SlideLelang } from "./SlideLelang";
import type { AuctionPublic, AdSettings } from "@/lib/queries";

// Panggung lelang layar-penuh (reels). Satu lelang memenuhi layar; antar-lelang digeser lewat tombol
// "lihat lelang lain" di bar aksi (onSkip). Form tebak/bayar menyatu di dalam bingkai (SlideLelang).
export function TheatreLelang({
  auctions,
  ad,
  userId,
  guesses,
}: {
  auctions: AuctionPublic[];
  ad: AdSettings;
  userId: string | null;
  guesses: Record<string, number>;
}) {
  const count = auctions.length;
  const [index, setIndex] = useState(0);
  const router = useRouter();

  // Realtime: dengar sinyal server lewat SSE → refetch data.
  useEffect(() => {
    const es = new EventSource("/api/lelang/stream");
    es.addEventListener("update", () => router.refresh());
    return () => es.close();
  }, [router]);

  if (count === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment p-8 text-center">
        <div className="text-4xl">🎪</div>
        <h3 className="mt-3 font-fraunces text-xl font-black text-kongsi-indigo">Belum ada lelang berjalan</h3>
        <p className="mt-2 text-sm text-kongsi-ink-soft">Saat balai kosong, nantikan sesi lelang berikutnya dari para saudagar.</p>
        {ad.video || ad.image ? (
          <div className="mt-4 overflow-hidden rounded-[6px] border-2 border-kongsi-ink">
            {ad.video ? (
              <video src={ad.video} autoPlay muted loop playsInline className="max-h-[260px] w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.image} alt="Pariwara" className="max-h-[260px] w-full object-cover" />
            )}
          </div>
        ) : null}
      </div>
    );
  }

  const current = auctions[Math.min(index, count - 1)];
  return (
    <div className="h-full">
      <SlideLelang
        key={current.id}
        auction={current}
        userId={userId}
        initialGuess={guesses[current.id] ?? null}
        hasOther={count > 1}
        onSkip={() => setIndex((i) => (i + 1) % count)}
      />
    </div>
  );
}
