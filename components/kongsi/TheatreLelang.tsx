"use client";

import { Panggung } from "./Panggung";
import { LelangLive } from "./LelangLive";
import { Pill, LiveDot } from "./Pill";
import type { AuctionPublic, AdSettings } from "@/lib/queries";

function StageAd({ ad }: { ad: AdSettings }) {
  const { video, image } = ad;
  return (
    <div className="text-center text-kongsi-parchment">
      <Pill variant="indigo" className="inline-flex items-center gap-[6px]">
        <LiveDot live={false} />
        Sekilas Pariwara
      </Pill>
      <div className="mt-4 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-black/70">
        {video ? (
          <video
            src={video}
            autoPlay
            muted
            loop
            playsInline
            className="mx-auto max-h-[300px] w-full object-cover"
          />
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="Pariwara"
            className="mx-auto max-h-[300px] w-full object-cover"
          />
        ) : (
          <div className="px-4 py-16 text-sm text-kongsi-parchment/80">
            Belum ada lelang berjalan.
            <br />
            Ruang panggung ini menayangkan iklan / video promosi Pekan Raya.
          </div>
        )}
      </div>
    </div>
  );
}

export function TheatreLelang({
  auction,
  ad,
  userId,
  initialGuess,
}: {
  auction: AuctionPublic | null;
  ad: AdSettings;
  userId: string | null;
  initialGuess: number | null;
}) {
  const celebrate = auction?.status === "pemenang";
  return (
    <Panggung celebrate={celebrate}>
      {auction ? (
        <LelangLive auction={auction} userId={userId} initialGuess={initialGuess} />
      ) : (
        <StageAd ad={ad} />
      )}
    </Panggung>
  );
}
