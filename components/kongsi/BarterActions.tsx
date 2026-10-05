"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ajukanTukar, tutupBarang } from "@/app/actions/tukar";
import { beaTukar, hitungSelisih } from "@/lib/domain/tukar-aturan";
import { cn, formatKeping } from "@/lib/utils";

type MyItem = { id: string; title: string; value: number };

const small = "rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-center text-[12px] font-bold";

export function AjukanTukar({
  targetId,
  targetValue,
  myItems,
  loggedIn,
  balance,
}: {
  targetId: string;
  targetValue: number;
  myItems: MyItem[];
  loggedIn: boolean;
  balance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [myId, setMyId] = useState(myItems[0]?.id ?? "");
  const mine = myItems.find((m) => m.id === myId) ?? myItems[0];
  const sel = mine ? hitungSelisih(mine.value, targetValue) : null;
  const [topupRaw, setTopupRaw] = useState<string | null>(null); // null = pakai default (selisih)

  if (!loggedIn) {
    return (
      <a href="/masuk" className={cn(small, "mt-2 block cursor-pointer bg-kongsi-beeswax")}>
        Masuk untuk tukar
      </a>
    );
  }
  if (!mine || !sel) {
    return (
      <a href="/tukar/tawarkan" className={cn(small, "mt-2 block cursor-pointer bg-kongsi-parchment-3")}>
        Unggah barang dulu
      </a>
    );
  }

  const topup = topupRaw === null ? sel.diff : Number(topupRaw.replace(/\D/g, "")) || 0;
  const feeMine = beaTukar(mine.value);
  const feeTheirs = beaTukar(targetValue);
  const ditahan = feeMine + (sel.from === "a" ? topup : 0);
  const kurang = ditahan > balance;

  async function kirim() {
    setBusy(true);
    setMsg(null);
    const { error, data } = await ajukanTukar(mine.id, targetId, sel!.from ? topup : 0);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    router.push(`/tukar/deal/${data}`);
  }

  const row = "flex justify-between gap-2";
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(small, "w-full cursor-pointer bg-kongsi-beeswax hover:bg-kongsi-beeswax-dark")}
      >
        Ajukan Tukar
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-kongsi-ink/50 sm:items-center"
              onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Ajukan tukar"
                className="max-h-[90vh] w-full max-w-[440px] space-y-2 overflow-y-auto rounded-t-[8px] border-2 border-kongsi-ink bg-kongsi-parchment-3 p-4 text-[13px] shadow-hard sm:rounded-[8px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="font-fraunces text-lg font-black text-kongsi-indigo">Ajukan Tukar</b>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Tutup"
                    className="cursor-pointer text-xl font-bold"
                  >
                    ×
                  </button>
                </div>
                <label className="block font-bold" htmlFor={`my-${targetId}`}>
                  Tukar dengan barangku
                </label>
                <select
                  id={`my-${targetId}`}
                  value={mine.id}
                  onChange={(e) => {
                    setMyId(e.target.value);
                    setTopupRaw(null);
                  }}
                  className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1"
                >
                  {myItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.title} ({formatKeping(it.value)})
                    </option>
                  ))}
                </select>

                {/* Kalkulator barter */}
                <div className="space-y-[2px] rounded-[3px] border-[1.5px] border-kongsi-ink/30 bg-kongsi-parchment p-2">
                  <div className={row}>
                    <span>Barangku</span>
                    <b>{formatKeping(mine.value)}</b>
                  </div>
                  <div className={row}>
                    <span>Barang dia</span>
                    <b>{formatKeping(targetValue)}</b>
                  </div>
                  <div className={cn(row, "border-t border-dashed border-kongsi-ink/30 pt-[2px]")}>
                    <span>Selisih</span>
                    <b className={sel.diff ? "text-kongsi-grenadine" : "text-kongsi-ok"}>
                      {sel.diff ? formatKeping(sel.diff) : "seimbang ✓"}
                    </b>
                  </div>
                </div>

                {sel.from ? (
                  <div>
                    <label className="block font-bold" htmlFor={`tp-${targetId}`}>
                      {sel.from === "a" ? "Kamu menambah Keteng (min. selisih)" : "Dia menambah Keteng (boleh kamu relakan)"}
                    </label>
                    <input
                      id={`tp-${targetId}`}
                      inputMode="numeric"
                      value={topup ? topup.toLocaleString("id-ID") : "0"}
                      onChange={(e) => setTopupRaw(e.target.value)}
                      className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1"
                    />
                  </div>
                ) : null}

                <div className="space-y-[2px]">
                  <div className={row}>
                    <span>Bea Tukar kamu (10%, maks 10rb)</span>
                    <b>{formatKeping(feeMine)}</b>
                  </div>
                  <div className={cn(row, "text-kongsi-ink-soft")}>
                    <span>Bea Tukar dia</span>
                    <span>{formatKeping(feeTheirs)}</span>
                  </div>
                  <div className={cn(row, "font-bold")}>
                    <span>Ditahan dari Pundimu sekarang</span>
                    <span>{formatKeping(ditahan)}</span>
                  </div>
                  <p className="text-[11px] text-kongsi-ink-soft">
                    Keteng ditahan Kongsi sampai tukar selesai. Ditolak / batal → kembali utuh.
                  </p>
                </div>

                {kurang ? (
                  <a href="/pakhuis" className={cn(small, "block bg-kongsi-beeswax")}>
                    Saldo {formatKeping(balance)} kurang — Isi Pundi
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={kirim}
                    className={cn(small, "w-full cursor-pointer bg-kongsi-grenadine text-kongsi-parchment disabled:opacity-60")}
                  >
                    {busy ? "Mengirim…" : "Kirim tawaran"}
                  </button>
                )}
                {msg ? <p className="text-[11px] text-kongsi-bad">{msg}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function TutupBarang({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function onClick() {
    setBusy(true);
    const { error } = await tutupBarang(id);
    setBusy(false);
    if (error) setMsg(error);
    else router.refresh();
  }
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={cn(small, "mt-2 w-full cursor-pointer bg-kongsi-parchment-3 text-kongsi-bad")}
      >
        Tutup
      </button>
      {msg ? <p className="mt-1 text-[11px] text-kongsi-bad">{msg}</p> : null}
    </>
  );
}
