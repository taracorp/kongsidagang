"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isiPundi, bayarTiruan } from "@/app/actions/pundi";
import {
  TOPUP_PACKAGES,
  NOMINAL_FAVORIT,
  TOPUP_MIN,
  TOPUP_MAX,
  rincianIsi,
  type RincianIsi,
} from "@/lib/pundi-paket";
import { cn } from "@/lib/utils";

const rb = (n: number) => `${(n / 1000).toLocaleString("id-ID")}rb`;
const singkat = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("id-ID")}jt` : rb(n));

export function IsiPundiPaket({ mode, saran }: { mode: "doku" | "demo" | null; saran?: number | null }) {
  const router = useRouter();
  // Pilihan = id paket atau nominal rupiah (string angka). Saran dari kekurangan saldo → nominal lain terisi.
  const [pick, setPick] = useState<string>(saran ? String(saran) : TOPUP_PACKAGES[2].id);
  const [lain, setLain] = useState<string>(saran && !NOMINAL_FAVORIT.includes(saran) ? String(saran) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let rincian: RincianIsi | null = null;
  let salah: string | null = null;
  try {
    rincian = rincianIsi(pick);
  } catch (e) {
    salah = e instanceof Error ? e.message : "Nominal tidak valid.";
  }

  async function onClick() {
    if (!rincian) {
      setErr(salah);
      return;
    }
    setBusy(true);
    setErr(null);
    const { error, data } = await isiPundi(pick);
    if (error) {
      setBusy(false);
      setErr(error);
      return;
    }
    if (data?.url) {
      window.location.href = data.url; // halaman bayar DOKU
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const kartu = (aktif: boolean) =>
    cn(
      "cursor-pointer rounded-[4px] border-2 px-2 py-2 text-left transition-transform",
      aktif
        ? "border-kongsi-ink bg-kongsi-parchment text-kongsi-ink shadow-hard-sm"
        : "border-kongsi-parchment/60 bg-kongsi-grenadine-dark text-kongsi-parchment",
    );
  const judulBagian = "mt-3 text-[11px] font-bold uppercase tracking-[1.5px] opacity-85";

  return (
    <div id="isi-pundi" className="relative z-10 mt-[14px]">
      {saran ? (
        <div className="mb-2 rounded-[4px] border-2 border-kongsi-ink bg-kongsi-beeswax px-3 py-2 text-[12px] font-semibold text-kongsi-ink">
          Saldo kurang untuk tukar/bayar — nominal Rp {saran.toLocaleString("id-ID")} sudah kami isikan. Boleh diubah.
        </div>
      ) : null}

      <div className="text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">Paket hemat — berbonus</div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {TOPUP_PACKAGES.map((p) => {
          const bonus = p.keteng - p.price;
          return (
            <button key={p.id} type="button" onClick={() => setPick(p.id)} aria-pressed={pick === p.id} className={kartu(pick === p.id)}>
              <div className="text-[11px] font-bold uppercase tracking-[0.6px]">{p.name}</div>
              <div className="font-fraunces text-lg font-black leading-tight">{rb(p.keteng)}</div>
              <div className="text-[11px] opacity-80">bayar Rp {p.price.toLocaleString("id-ID")}</div>
              {bonus > 0 ? (
                <b className="mt-1 inline-block rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-beeswax px-[6px] text-[10px] text-kongsi-ink">
                  bonus +{rb(bonus)}
                </b>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={judulBagian}>Nominal favorit</div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {NOMINAL_FAVORIT.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setPick(String(n));
              setLain("");
            }}
            aria-pressed={pick === String(n)}
            className={cn(kartu(pick === String(n)), "text-center")}
          >
            <div className="font-fraunces text-lg font-black leading-tight">{singkat(n)}</div>
          </button>
        ))}
      </div>

      <label className={cn(judulBagian, "block")} htmlFor="isi-nominal">
        Nominal lain (Rp {TOPUP_MIN.toLocaleString("id-ID")} – Rp {TOPUP_MAX.toLocaleString("id-ID")})
      </label>
      <input
        id="isi-nominal"
        inputMode="numeric"
        value={lain ? Number(lain).toLocaleString("id-ID") : ""}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "");
          setLain(v);
          setPick(v);
        }}
        onFocus={() => lain && setPick(lain)}
        placeholder="cth. 1.500.000"
        className="mt-2 w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm text-kongsi-ink focus:outline-2 focus:outline-kongsi-beeswax"
      />

      <button
        type="button"
        onClick={onClick}
        disabled={busy || mode === null}
        className="mt-[12px] inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-[22px] py-3 text-sm font-bold text-kongsi-ink shadow-hard transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm disabled:opacity-60"
      >
        {mode === null
          ? "Isi Pundi belum tersedia"
          : busy
            ? mode === "doku"
              ? "Membuka DOKU…"
              : "Mengisi…"
            : rincian
              ? `Isi ${rincian.keteng.toLocaleString("id-ID")} Keteng — bayar Rp ${rincian.price.toLocaleString("id-ID")}${mode === "demo" ? " (demo)" : ""}`
              : "Pilih paket atau isi nominal"}
      </button>
      {err || (pick === lain && lain && salah) ? (
        <div className="mt-2 text-[12px] font-semibold">{err ?? salah}</div>
      ) : null}
      <p className="mt-2 text-[11px] opacity-80">
        {mode === "doku" ? "Dibayar di halaman aman DOKU — pilih metode yang tersedia di sana. " : ""}
        Keteng tidak dapat diuangkan kembali — dipakai untuk belanja, bea Tukar Guling, & lelang.
      </p>
    </div>
  );
}

/** Tombol di halaman bayar tiruan (DOKU_MOCK=true). */
export function BayarTiruan({ invoice }: { invoice: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await bayarTiruan(invoice);
          setBusy(false);
          if (error) setErr(error);
          else router.push(`/pakhuis?isi=${encodeURIComponent(invoice)}`);
        }}
        className="inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-[22px] py-3 text-sm font-bold text-kongsi-parchment shadow-hard disabled:opacity-60"
      >
        {busy ? "Memproses…" : "Bayar (simulasi sukses)"}
      </button>
      {err ? <p className="mt-2 text-[12px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
