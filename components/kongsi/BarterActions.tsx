"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ajukanTukar, tutupBarang, mintaTera } from "@/app/actions/tukar";
import { beaTukar, depositKirim, hitungSelisih } from "@/lib/domain/tukar-aturan";
import { tautanIsi } from "@/lib/pundi-paket";
import { cn, formatKeping } from "@/lib/utils";

type MyItem = { id: string; title: string; value: number; kirimOk: boolean };
type AlamatPilihan = { id: string; label: string; area: string };

const small = "rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-center text-[12px] font-bold";

export function AjukanTukar({
  targetId,
  targetValue,
  targetKirimOk,
  myItems,
  loggedIn,
  balance,
  kirimAktif,
  alamat,
}: {
  targetId: string;
  targetValue: number;
  targetKirimOk: boolean;
  myItems: MyItem[];
  loggedIn: boolean;
  balance: number;
  kirimAktif: boolean;
  alamat: AlamatPilihan[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [myId, setMyId] = useState(myItems[0]?.id ?? "");
  const mine = myItems.find((m) => m.id === myId) ?? myItems[0];
  const sel = mine ? hitungSelisih(mine.value, targetValue) : null;
  const [topupRaw, setTopupRaw] = useState<string | null>(null); // null = pakai default (selisih)
  const [mode, setMode] = useState<"cod" | "kirim">("cod");
  const [addressId, setAddressId] = useState(alamat[0]?.id ?? "");

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
  const bisaKirim = kirimAktif && mine.kirimOk && targetKirimOk;
  const modeAktif = bisaKirim ? mode : "cod";
  const deposit = modeAktif === "kirim" ? depositKirim(mine.value) : 0;
  const ditahan = feeMine + (sel.from === "a" ? topup : 0) + deposit;
  const kurang = ditahan > balance;
  const butuhAlamat = modeAktif === "kirim" && !addressId;

  async function kirim() {
    setBusy(true);
    setMsg(null);
    const { error, data } = await ajukanTukar(
      mine.id,
      targetId,
      sel!.from ? topup : 0,
      modeAktif,
      modeAktif === "kirim" ? addressId : null,
    );
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

                {kirimAktif ? (
                  <div>
                    <div className="mb-1 font-bold">Cara tukar</div>
                    <div className="flex gap-2">
                      {(
                        [
                          { v: "cod", l: "🤝 COD ketemuan" },
                          { v: "kirim", l: "📦 Kirim kurir" },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          aria-pressed={modeAktif === o.v}
                          disabled={o.v === "kirim" && !bisaKirim}
                          onClick={() => setMode(o.v)}
                          className={cn(
                            "flex-1 cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-3 py-2 font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50",
                            modeAktif === o.v ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment hover:bg-kongsi-beeswax",
                          )}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                    {!bisaKirim ? (
                      <p className="mt-1 text-[11px] text-kongsi-ink-soft">Kirim kurir butuh dua barang yang sudah ditaksir.</p>
                    ) : null}
                    {modeAktif === "kirim" ? (
                      <div className="mt-2">
                        <label className="block font-bold" htmlFor={`adr-${targetId}`}>
                          Alamat jemput / kirim
                        </label>
                        {alamat.length ? (
                          <select
                            id={`adr-${targetId}`}
                            value={addressId}
                            onChange={(e) => setAddressId(e.target.value)}
                            className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1"
                          >
                            {alamat.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label} — {a.area}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <a href="/pakhuis/alamat" className="mt-1 inline-block text-[12px] font-bold text-kongsi-grenadine">
                          {alamat.length ? "+ Kelola alamat" : "+ Tambah alamat dulu"}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
                  {deposit > 0 ? (
                    <div className={row}>
                      <span>Deposit Kirim (kembali saat selesai)</span>
                      <b>{formatKeping(deposit)}</b>
                    </div>
                  ) : null}
                  <div className={cn(row, "font-bold")}>
                    <span>Ditahan dari Pundimu sekarang</span>
                    <span>{formatKeping(ditahan)}</span>
                  </div>
                  <p className="text-[11px] text-kongsi-ink-soft">
                    Keteng ditahan Kongsi sampai tukar selesai. Ditolak / batal → kembali utuh.
                    {modeAktif === "kirim" ? " Ongkir barang yang kamu terima ditagih setelah tawaran diterima." : ""}
                  </p>
                </div>

                {kurang ? (
                  <a href={tautanIsi(ditahan - balance)} className={cn(small, "block bg-kongsi-beeswax")}>
                    Saldo {formatKeping(balance)} kurang — Isi Pundi
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={busy || butuhAlamat}
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

/** Pemilik minta nilai barangnya ditera Penaksir (bila merasa taksiran kurang tepat). */
export function MintaTera({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(small, "mt-2 w-full cursor-pointer bg-kongsi-parchment-3")}>
        Minta tera Penaksir
      </button>
    );
  }
  async function kirim() {
    setBusy(true);
    setMsg(null);
    const { error } = await mintaTera(id, note);
    setBusy(false);
    if (error) setMsg(error);
    else router.refresh();
  }
  return (
    <div className="mt-2 space-y-2">
      <label className="block text-[12px] font-bold" htmlFor={`tera-${id}`}>
        Kenapa taksiran kurang tepat? (sertakan link pembanding bila ada)
      </label>
      <textarea
        id={`tera-${id}`}
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={cn(small, "cursor-pointer bg-kongsi-parchment")}>
          Batal
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={kirim}
          className={cn(small, "flex-1 cursor-pointer bg-kongsi-grenadine text-kongsi-parchment disabled:opacity-60")}
        >
          {busy ? "Mengirim…" : "Kirim ke Penaksir"}
        </button>
      </div>
      {msg ? <p className="text-[11px] text-kongsi-bad">{msg}</p> : null}
    </div>
  );
}
