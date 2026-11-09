"use client";

import { useState } from "react";
import { BangKongsi, type GerakBang } from "./BangKongsi";

const MOVES: { g: GerakBang; label: string; kapan: string; ucap: string }[] = [
  { g: "diam", label: "Diam", kapan: "dasar (selalu)", ucap: "Selamat datang di Balai Lelang Kongsi!" },
  { g: "lambai", label: "Melambai", kapan: "fase kumpul", ucap: "Ayo kumpul, sobat Kongsi!" },
  { g: "tunjuk", label: "Menunjuk", kapan: "slide clue", ucap: "Lihat clue yang satu ini…" },
  { g: "nonton", label: "Nonton bareng", kapan: "slide TVC", ucap: "Kita tonton dulu videonya ya!" },
  { g: "palu", label: "Ketuk palu", kapan: "slide tebak", ucap: "Tebak harganya… ketok!" },
  { g: "menang", label: "Menang + tepuk", kapan: "pemenang", ucap: "Selamat, pemenangnya kamu!" },
  { g: "bisik", label: "Berbisik", kapan: "lelang khusus", ucap: "Ini khusus anggota, ssst…" },
];

export function BangKongsiDemo() {
  const [move, setMove] = useState<GerakBang>("lambai");
  const [bicara, setBicara] = useState(true);
  const aktif = MOVES.find((m) => m.g === move)!;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative w-[240px] shrink-0 rounded-[8px] border-2 border-kongsi-ink bg-gradient-to-br from-kongsi-indigo to-kongsi-indigo-dark p-3">
        <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-[5px] rounded-full border-2 border-kongsi-ink bg-kongsi-grenadine px-2 py-[2px] text-[10px] font-black uppercase tracking-[1px] text-kongsi-parchment">
          <span className="live-dot" /> Live
        </div>
        {bicara ? (
          <div className="relative z-10 mx-auto mb-1 max-w-[200px] rounded-[10px] border-2 border-kongsi-ink bg-kongsi-parchment px-3 py-2 text-center text-[12px] font-semibold text-kongsi-ink shadow-hard-sm">
            {aktif.ucap}
          </div>
        ) : null}
        <BangKongsi gerak={move} bicara={bicara} size={214} className="mx-auto" />
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap gap-2">
          {MOVES.map((m) => (
            <button
              key={m.g}
              type="button"
              onClick={() => setMove(m.g)}
              className={`rounded-[3px] border-2 border-kongsi-ink px-3 py-[6px] text-[13px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] ${
                move === m.g ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-kongsi-ink-soft">
          Gerakan <b className="text-kongsi-indigo">{aktif.label}</b> — dipakai saat:{" "}
          <b>{aktif.kapan}</b>.
        </p>
        <label className="mt-3 flex items-center gap-2 text-[13px] font-bold">
          <input type="checkbox" checked={bicara} onChange={(e) => setBicara(e.target.checked)} />
          Mulut bergerak (sedang bicara)
        </label>
        <p className="mt-3 text-[12px] text-kongsi-ink-soft">
          Semua gerakan halus &amp; berulang. Saat <code>prefers-reduced-motion</code> aktif, tokoh diam.
        </p>
      </div>
    </div>
  );
}
