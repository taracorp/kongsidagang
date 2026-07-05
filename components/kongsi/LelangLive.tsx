"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pill, LiveDot } from "./Pill";
import { KongsiButton, KongsiLinkButton } from "./KongsiButton";
import { formatKeping } from "@/lib/utils";
import type { AuctionPublic } from "@/lib/queries";

const statusLabel: Record<string, string> = {
  kumpul: "Menunggu peserta",
  tebak: "Babak tebak dibuka",
  jeda: "Jeda menuju final",
  final: "Babak final",
  pemenang: "Pemenang ditentukan",
  bayar: "Menunggu pembayaran",
  selesai: "Selesai",
};

export function LelangLive({
  auction,
  userId,
  initialGuess,
}: {
  auction: AuctionPublic;
  userId: string | null;
  initialGuess: number | null;
}) {
  const [joined, setJoined] = useState(false);
  const [guess, setGuess] = useState<number | null>(initialGuess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = auction.status === "kumpul" || auction.status === "tebak";

  async function join() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("auction_participants")
      .upsert({ auction_id: auction.id, user_id: userId });
    setBusy(false);
    if (error) setError(error.message);
    else setJoined(true);
  }

  async function submitGuess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const raw = String(new FormData(e.currentTarget).get("guess") ?? "").replace(
      /\D/g,
      "",
    );
    const val = Number(raw);
    if (!val) {
      setError("Isi tebakan harga.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    await supabase
      .from("auction_participants")
      .upsert({ auction_id: auction.id, user_id: userId });
    const { error } = await supabase
      .from("auction_guesses")
      .insert({ auction_id: auction.id, user_id: userId, round: 1, guess: val });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setGuess(val);
      setJoined(true);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-[500px]">
      <div className="rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment p-6 text-center shadow-hard">
        <Pill variant={open ? "live" : "indigo"} className="inline-flex items-center gap-[6px]">
          <LiveDot live={open} />
          {statusLabel[auction.status] ?? auction.status}
        </Pill>
        <div className="mt-[10px] font-fraunces text-[21px] font-black text-kongsi-indigo">
          {auction.clue_category}
        </div>
        <div className="mt-[2px] text-[13px] text-kongsi-ink-soft">
          Nama loji:{" "}
          <b className="font-fraunces tracking-[3px] text-kongsi-grenadine">
            {auction.clue_name_masked}
          </b>{" "}
          · disamarkan sampai menang
        </div>

        {auction.facilities?.length ? (
          <div className="my-4 rounded-[4px] border-[1.5px] border-dashed border-kongsi-olive bg-kongsi-parchment-3 p-[14px_16px] text-left text-[13px]">
            <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
              Yang kamu dapat
            </div>
            <ul>
              {auction.facilities.map((f) => (
                <li
                  key={f}
                  className="relative list-none py-[2px] pl-[18px] before:absolute before:left-0 before:text-kongsi-beeswax before:content-['◆']"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="text-[13px] text-kongsi-ink-soft">
          Harga normal:{" "}
          <b className="font-fraunces text-lg text-kongsi-grenadine line-through">
            {formatKeping(auction.normal_price)}
          </b>
        </div>

        {!userId ? (
          <div className="mt-5">
            <p className="mb-3 text-[13px] text-kongsi-ink-soft">
              Masuk loji dulu untuk ikut menebak.
            </p>
            <KongsiLinkButton href="/masuk" variant="primary" block>
              Masuk untuk Ikut Lelang
            </KongsiLinkButton>
          </div>
        ) : !open ? (
          <p className="mt-5 text-[13px] text-kongsi-ink-soft">
            Lelang ini sedang di fase <b>{auction.status}</b> — pantau terus.
          </p>
        ) : (
          <form onSubmit={submitGuess} className="mt-5">
            <div className="my-[14px] flex">
              <div className="flex flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-white">
                <span className="flex items-center bg-kongsi-indigo px-3 font-bold text-kongsi-parchment">
                  Rp
                </span>
                <input
                  name="guess"
                  inputMode="numeric"
                  defaultValue={guess ? guess.toLocaleString("id-ID") : ""}
                  placeholder="tebak harga set…"
                  className="w-full px-3 py-2 font-fraunces text-xl font-black outline-none"
                />
              </div>
            </div>
            <KongsiButton type="submit" variant="primary" block disabled={busy}>
              {busy ? "Menyimpan…" : guess ? "Ubah Tebakan" : "Kunci Tebakan"}
            </KongsiButton>
            {(joined || guess) && !error ? (
              <p className="mt-3 text-[13px] font-bold text-kongsi-ok">
                ✓ Kamu ikut lelang ini
                {guess ? ` · tebakan: ${formatKeping(guess)}` : ""}
              </p>
            ) : null}
            {!guess ? (
              <button
                type="button"
                onClick={join}
                disabled={busy || joined}
                className="mt-2 cursor-pointer text-[12px] font-bold text-kongsi-grenadine underline disabled:opacity-60"
              >
                {joined ? "Sudah ikut" : "Ikut dulu tanpa menebak"}
              </button>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
}
