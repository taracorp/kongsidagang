"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Panggung } from "./Panggung";
import { LelangLive } from "./LelangLive";
import { Pill, LiveDot } from "./Pill";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AuctionPublic, AdSettings } from "@/lib/queries";

const SWAP_MS = 1300;
const AUTOPLAY_MS = 9000;

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
  const [open, setOpen] = useState(false);
  const swapTimer = useRef<number | null>(null);
  const reduce = useRef(false);
  const router = useRouter();

  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setOpen(true), reduce.current ? 0 : 550);
    return () => clearTimeout(t);
  }, []);

  // Realtime: dengar sinyal admin lewat Broadcast → refetch data server.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("kongsi-lelang");
    ch.on("broadcast", { event: "update" }, () => router.refresh()).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [router]);

  // Saat data lelang berubah (mis. admin ubah status), mainkan transisi tirai.
  const signature = auctions.map((a) => `${a.id}:${a.status}`).join("|");
  const prevSig = useRef(signature);
  useEffect(() => {
    if (prevSig.current === signature) return;
    prevSig.current = signature;
    setIndex((i) => (i >= count ? 0 : i));
    setOpen(false);
    const t = window.setTimeout(
      () => setOpen(true),
      reduce.current ? 0 : SWAP_MS,
    );
    return () => clearTimeout(t);
  }, [signature, count]);

  const goTo = useCallback((next: number) => {
    if (swapTimer.current) return;
    setOpen(false);
    const delay = reduce.current ? 0 : SWAP_MS;
    swapTimer.current = window.setTimeout(() => {
      setIndex(next);
      setOpen(true);
      swapTimer.current = null;
    }, delay);
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (count < 2) return;
      goTo((index + dir + count) % count);
    },
    [count, index, goTo],
  );

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      setOpen(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % count);
        setOpen(true);
      }, reduce.current ? 0 : SWAP_MS);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [count]);

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    },
    [],
  );

  const current = count ? auctions[index] : null;
  const celebrate = current?.status === "pemenang";
  const nextItem = count > 1 ? auctions[(index + 1) % count] : null;

  return (
    <div>
      <Panggung open={open} celebrate={celebrate}>
        {current ? (
          <LelangLive
            key={current.id}
            auction={current}
            userId={userId}
            initialGuess={guesses[current.id] ?? null}
          />
        ) : (
          <StageAd ad={ad} />
        )}
      </Panggung>

      {count > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Barang sebelumnya"
            onClick={() => step(-1)}
            className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment px-3 py-2 font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            ‹
          </button>
          <div className="flex-1 text-center">
            <div className="flex justify-center gap-[6px]">
              {auctions.map((a, i) => (
                <span
                  key={a.id}
                  className={cn(
                    "h-[7px] w-[7px] rounded-full border border-kongsi-ink",
                    i === index ? "bg-kongsi-grenadine" : "bg-kongsi-parchment-2",
                  )}
                />
              ))}
            </div>
            {nextItem ? (
              <div className="mt-[6px] text-[12px] text-kongsi-ink-soft">
                Berikutnya:{" "}
                <b className="text-kongsi-indigo">{nextItem.clue_category}</b>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Barang berikutnya"
            onClick={() => step(1)}
            className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment px-3 py-2 font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
