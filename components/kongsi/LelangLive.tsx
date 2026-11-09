"use client";

import { useState } from "react";
import { ikutLelang, tebakLelang } from "@/app/actions/lelang";
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
  bayar: "Menunggu pembayaran pemenang",
  selesai: "Selesai",
};

// Panel interaktif di bawah panggung slide: info lapak + status + form tebak / reveal pemenang.
export function PanelTebak({
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
  const decided = auction.revealed_price != null;
  const iWon = Boolean(userId && auction.hak_user_id && auction.hak_user_id === userId);

  async function join() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error } = await ikutLelang(auction.id);
    setBusy(false);
    if (error) setError(error);
    else setJoined(true);
  }

  async function submitGuess(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;
    const raw = String(new FormData(e.currentTarget).get("guess") ?? "").replace(/\D/g, "");
    const val = Number(raw);
    if (!val) {
      setError("Isi tebakan harga.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await tebakLelang(auction.id, val);
    setBusy(false);
    if (error) setError(error);
    else {
      setGuess(val);
      setJoined(true);
    }
  }

  return (
    <div className="mx-auto mt-4 max-w-[460px]">
      <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 text-center shadow-hard">
        <div className="flex items-center justify-center gap-2">
          <Pill variant={open ? "live" : "indigo"} className="inline-flex items-center gap-[6px]">
            <LiveDot live={open} />
            {statusLabel[auction.status] ?? auction.status}
          </Pill>
        </div>
        {auction.merchant_name ? (
          <div className="mt-2 text-[13px] text-kongsi-ink-soft">
            Lapak:{" "}
            {auction.merchant_slug ? (
              <a href={`/lapak/${auction.merchant_slug}`} className="font-fraunces font-black text-kongsi-grenadine underline">
                {auction.merchant_name}
              </a>
            ) : (
              <b className="font-fraunces text-kongsi-grenadine">{auction.merchant_name}</b>
            )}
          </div>
        ) : null}

        {decided ? (
          <div className="mt-4">
            <Pill variant="gold">🎉 Pemenang</Pill>
            <div className="mt-2 font-fraunces text-2xl font-black text-kongsi-grenadine">
              {auction.winner_name ?? "—"}
            </div>
            <div className="my-4 flex justify-center gap-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">Tebakan</div>
                <div className="font-fraunces text-lg font-black text-kongsi-indigo">
                  {auction.winning_guess != null ? formatKeping(auction.winning_guess) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">Harga asli</div>
                <div className="font-fraunces text-lg font-black text-kongsi-ok">
                  {formatKeping(auction.revealed_price ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">Selisih</div>
                <div className="font-fraunces text-lg font-black text-kongsi-indigo">
                  {auction.winning_guess != null && auction.revealed_price != null
                    ? formatKeping(Math.abs(auction.revealed_price - auction.winning_guess))
                    : "—"}
                </div>
              </div>
            </div>
            {iWon ? (
              <div className="rounded-[4px] border-2 border-kongsi-ok bg-kongsi-sage/30 px-3 py-3 text-[13px] font-bold text-kongsi-ok">
                🏆 Kamu pemegang hak beli{auction.hak_peringkat && auction.hak_peringkat > 1 ? ` (peringkat ${auction.hak_peringkat})` : ""}! Bayar sebelum batas waktu untuk mendapatkan Voucher.
                <a href={`/lelang/bayar/${auction.id}`} className="mt-2 block rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-2 text-kongsi-parchment">
                  Bayar sekarang →
                </a>
              </div>
            ) : auction.hak_peringkat && auction.hak_peringkat > 1 ? (
              <p className="text-[12px] text-kongsi-ink-soft">Pemenang pertama tidak membayar — hak beli pindah ke peringkat {auction.hak_peringkat}.</p>
            ) : null}
          </div>
        ) : !userId ? (
          <div className="mt-4">
            <p className="mb-3 text-[13px] text-kongsi-ink-soft">Masuk dulu untuk ikut menebak.</p>
            <KongsiLinkButton href="/masuk" variant="primary" block>
              Masuk untuk Ikut Lelang
            </KongsiLinkButton>
          </div>
        ) : !open ? (
          <p className="mt-4 text-[13px] text-kongsi-ink-soft">
            Lelang ini sedang di fase <b>{auction.status}</b> — pantau terus.
          </p>
        ) : (
          <form onSubmit={submitGuess} className="mt-4">
            <div className="my-[14px] flex">
              <div className="flex flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-white">
                <span className="flex items-center bg-kongsi-indigo px-3 font-bold text-kongsi-parchment">Rp</span>
                <input
                  name="guess"
                  inputMode="numeric"
                  defaultValue={guess ? guess.toLocaleString("id-ID") : ""}
                  placeholder="tebak harga tebus…"
                  className="w-full px-3 py-2 font-fraunces text-xl font-black outline-none"
                />
              </div>
            </div>
            <KongsiButton type="submit" variant="primary" block disabled={busy}>
              {busy ? "Menyimpan…" : guess ? "Ubah Tebakan" : "Kunci Tebakan"}
            </KongsiButton>
            {(joined || guess) && !error ? (
              <p className="mt-3 text-[13px] font-bold text-kongsi-ok">
                ✓ Kamu ikut lelang ini{guess ? ` · tebakan: ${formatKeping(guess)}` : ""}
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
        <p className="mt-3 text-[11px] text-kongsi-ink-soft">
          Menang = wajib membayar harga tebus + platform fee + biaya pembayaran dalam 12 jam. Tidak bayar → hak pindah ke peringkat berikutnya.
        </p>
      </div>
    </div>
  );
}
