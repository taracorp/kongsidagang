"use client";

import { useState } from "react";
import { Pill } from "./Pill";
import { WaxSeal } from "./icons";
import { KongsiButton, KongsiLinkButton } from "./KongsiButton";
import { cn, formatKeping } from "@/lib/utils";
import { lelangClue } from "@/lib/data-e";

const phases = [
  "1 · Kumpul",
  "2 · Tebak",
  "2.5 · Jeda",
  "3 · Final",
  "4 · Pemenang",
  "5 · Bayar",
  "6 · Selesai",
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment p-6 text-center shadow-hard">
      {children}
    </div>
  );
}

function Timer({ value, label }: { value: string; label: string }) {
  return (
    <div className="font-fraunces text-[48px] font-black leading-none text-kongsi-grenadine">
      {value}
      <small className="block font-work text-[10px] font-bold uppercase tracking-[2px] text-kongsi-olive">
        {label}
      </small>
    </div>
  );
}

function GuessInput({ value, placeholder }: { value?: string; placeholder?: string }) {
  return (
    <div className="my-[14px] flex">
      <div className="flex flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-white">
        <span className="flex items-center bg-kongsi-indigo px-3 font-bold text-kongsi-parchment">
          Rp
        </span>
        <input
          defaultValue={value}
          placeholder={placeholder}
          inputMode="numeric"
          className="w-full px-3 py-2 font-fraunces text-xl font-black outline-none"
        />
      </div>
    </div>
  );
}

function Prow({
  name,
  done,
  right,
}: {
  name: string;
  done?: boolean;
  right: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-[5px] flex items-center justify-between rounded-[3px] border-[1.5px] border-kongsi-ink px-[11px] py-[7px] text-[13px]",
        done ? "bg-[#E4EFE5]" : "bg-kongsi-parchment-3",
      )}
    >
      <span>
        {done ? "✓" : "○"} {name}
      </span>
      {right}
    </div>
  );
}

export function BalaiLelang() {
  const [phase, setPhase] = useState(1);

  return (
    <div>
      <div className="my-4 flex flex-wrap justify-center gap-[5px]">
        {phases.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setPhase(i + 1)}
            className={cn(
              "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-[10px] py-[5px] text-[11px] font-bold",
              phase === i + 1
                ? "bg-kongsi-indigo text-kongsi-parchment"
                : "bg-kongsi-parchment text-kongsi-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-[500px]">
        {phase === 1 && (
          <Card>
            <Pill variant="live">◉ Menunggu peserta</Pill>
            <div className="mt-[10px] font-fraunces text-[21px] font-black text-kongsi-indigo">
              {lelangClue.kategori}
            </div>
            <div className="mt-[2px] text-[13px] text-kongsi-ink-soft">
              Nama loji:{" "}
              <b className="font-fraunces tracking-[3px] text-kongsi-grenadine">
                {lelangClue.namaLoji}
              </b>
            </div>
            <div className="my-4 rounded-[4px] border-[1.5px] border-dashed border-kongsi-olive bg-kongsi-parchment-3 p-[14px_16px] text-left text-[13px]">
              <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                Yang kamu dapat
              </div>
              <ul>
                {lelangClue.fasilitas.map((f) => (
                  <li
                    key={f}
                    className="relative list-none py-[2px] pl-[18px] before:absolute before:left-0 before:text-kongsi-beeswax before:content-['◆']"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-[13px] text-kongsi-ink-soft">
              Harga normal:{" "}
              <b className="font-fraunces text-lg text-kongsi-grenadine line-through">
                {formatKeping(lelangClue.hargaNormal)}
              </b>{" "}
              / malam
            </div>
            <div className="mt-3 font-fraunces text-[32px] font-black text-kongsi-indigo">
              7{" "}
              <small className="block font-work text-xs font-semibold text-kongsi-ink-soft">
                dari 10 peserta — butuh 3 lagi
              </small>
            </div>
            <div className="my-[6px] h-[11px] overflow-hidden rounded-full border-2 border-kongsi-ink bg-kongsi-parchment-2">
              <i className="block h-full w-[70%] bg-kongsi-beeswax" />
            </div>
            <Timer value="08:42" label="mulai dalam" />
            <KongsiButton variant="primary" block className="mt-[14px]">
              Ikut Lelang
            </KongsiButton>
            <p className="mt-2 text-[11px] text-kongsi-ink-soft">
              Belum masuk loji? Tak apa — daftar kilat muncul saat kamu klik
              ikut.
            </p>
          </Card>
        )}

        {phase === 2 && (
          <Card>
            <Timer value="00:34" label="tebak babak 1" />
            <div className="mt-2 text-[13px] text-kongsi-ink-soft">
              Harga normal{" "}
              <b className="font-fraunces text-lg text-kongsi-grenadine line-through">
                {formatKeping(lelangClue.hargaNormal)}
              </b>{" "}
              — tebak harga yang kami set!
            </div>
            <GuessInput value="467.000" />
            <KongsiButton variant="gold" block>
              Ubah Tebakan
            </KongsiButton>
            <div className="mt-3 text-left">
              <Prow name="Tara D." done right={<span className="font-fraunces font-black tracking-[2px] text-kongsi-grenadine">4•••••0</span>} />
              <Prow name="Rina A." done right={<span className="font-fraunces font-black tracking-[2px] text-kongsi-grenadine">3•••••0</span>} />
              <Prow name="Dewi S." done right={<span className="font-fraunces font-black tracking-[2px] text-kongsi-grenadine">4•••••0</span>} />
              <Prow name="Ahmad R." right={<span className="text-[12px] text-kongsi-ink-soft">belum submit</span>} />
            </div>
          </Card>
        )}

        {phase === 3 && (
          <Card>
            <Pill variant="gold">🏆 Top 3 · Masuk Final</Pill>
            <div className="mt-4 text-left">
              {["Tara D.", "Rina A.", "Dewi S."].map((n, i) => (
                <div
                  key={n}
                  className="mb-2 flex items-center gap-3 rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment p-[12px_16px] shadow-hard-sm"
                >
                  <span className="w-[30px] font-fraunces text-2xl font-black text-kongsi-beeswax-dark">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-bold">{n}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">
                    disamarkan
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-[14px]">
              <Timer value="00:22" label="babak final dimulai" />
            </div>
          </Card>
        )}

        {phase === 4 && (
          <Card>
            <Pill variant="live">🏆 Babak Final · 3 peserta</Pill>
            <div className="mt-[10px]">
              <Timer value="00:45" label="tebak final — rahasia penuh" />
            </div>
            <GuessInput placeholder="_______" />
            <KongsiButton variant="primary" block>
              Kunci Tebakan
            </KongsiButton>
            <div className="mt-3 text-left">
              <Prow name="Tara D." done right={<span className="text-[12px] text-kongsi-ink-soft">sudah submit</span>} />
              <Prow name="Rina A." right={<span className="text-[12px] text-kongsi-ink-soft">belum submit</span>} />
              <Prow name="Dewi S." done right={<span className="text-[12px] text-kongsi-ink-soft">sudah submit</span>} />
            </div>
          </Card>
        )}

        {phase === 5 && (
          <Card>
            <Pill variant="gold">🎉 Pemenang!</Pill>
            <div className="mt-2 font-fraunces text-[28px] font-black text-kongsi-grenadine">
              Tara D.
            </div>
            <div className="my-4 flex justify-center gap-[22px]">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                  Tebakan
                </div>
                <div className="font-fraunces text-[22px] font-black text-kongsi-indigo">
                  Rp 469.000
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                  Harga asli
                </div>
                <div className="font-fraunces text-[22px] font-black text-kongsi-ok">
                  Rp 470.000
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                  Selisih
                </div>
                <div className="font-fraunces text-[22px] font-black text-kongsi-indigo">
                  Rp 1.000
                </div>
              </div>
            </div>
            <KongsiLinkButton href="/bayar" variant="primary" block className="mt-[14px]">
              Bayar Sekarang — Rp 470.000
            </KongsiLinkButton>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">
              Bayar dalam 30:00 menit
            </div>
          </Card>
        )}

        {phase === 6 && (
          <Card>
            <Pill variant="live">◉ Menunggu pembayaran</Pill>
            <div className="mt-[10px]">
              <Timer value="29:12" label="batas bayar" />
            </div>
            <div className="my-4">
              <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                Total tebus
              </div>
              <div className="font-fraunces text-[22px] font-black text-kongsi-indigo">
                Rp 470.000
              </div>
            </div>
            <KongsiLinkButton href="/bayar" variant="primary" block>
              Lanjut ke DOKU
            </KongsiLinkButton>
            <p className="mt-[10px] text-[12px] text-kongsi-ink-soft">
              Peserta lain melihat:{" "}
              <em>“Menunggu pemenang menyelesaikan pembayaran…”</em>
            </p>
          </Card>
        )}

        {phase === 7 && (
          <Card>
            <Pill variant="sage">✅ Pembayaran berhasil</Pill>
            <div className="mt-2 font-fraunces text-2xl font-black text-kongsi-indigo">
              🏨 Hotel Artotel Yogyakarta
            </div>
            <p className="mt-[5px] text-kongsi-ink-soft">
              Kamar Deluxe — 1 malam · Free breakfast
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-[6px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-[14px_16px] text-left">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[6px] border-2 border-kongsi-ink bg-kongsi-beeswax">
                <WaxSeal size={22} />
              </span>
              <span>
                <b className="font-fraunces text-kongsi-indigo">
                  Surat Jalan terbit
                </b>
                <span className="block text-[12px] text-kongsi-ink-soft">
                  Voucher dikirim ke email dalam 15 menit
                </span>
              </span>
            </div>
            <KongsiLinkButton href="/pakhuis" variant="gold" block className="mt-4">
              Lihat di Pakhuis-ku
            </KongsiLinkButton>
          </Card>
        )}
      </div>
    </div>
  );
}
