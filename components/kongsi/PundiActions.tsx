"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isiPundi, bayarTiruan } from "@/app/actions/pundi";
import { NOMINAL_CEPAT, TOPUP_MIN, TOPUP_MAX, nominalIsi } from "@/lib/pundi-paket";
import { rincianBayar } from "@/lib/payment/biaya";
import { cn } from "@/lib/utils";
import { PilihMetode } from "./PilihMetode";

const rb = (n: number) => `${(n / 1000).toLocaleString("id-ID")}rb`;
const singkat = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("id-ID")}jt` : rb(n));

/**
 * Isi Pundi (Keteng — khusus Tukar Guling). Keteng masuk = nominal, tanpa bonus; pembeli membayar nominal +
 * biaya pembayaran metode pilihannya (tanpa platform fee).
 */
export function IsiPundiPaket({ mode, saran }: { mode: "doku" | "demo" | null; saran?: number | null }) {
  const router = useRouter();
  const [pick, setPick] = useState<string>(saran ? String(saran) : String(NOMINAL_CEPAT[2]));
  const [lain, setLain] = useState<string>(saran && !NOMINAL_CEPAT.includes(saran) ? String(saran) : "");
  const [metode, setMetode] = useState("QRIS");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  let nominal: number | null = null;
  let salah: string | null = null;
  try {
    nominal = nominalIsi(pick);
  } catch (e) {
    salah = e instanceof Error ? e.message : "Nominal tidak valid.";
  }
  const tagihan = nominal && mode === "doku" ? rincianBayar(nominal, metode) : null;

  async function onClick() {
    if (!nominal) {
      setErr(salah);
      return;
    }
    setBusy(true);
    setErr(null);
    const { error, data } = await isiPundi(String(nominal), metode);
    if (error) {
      setBusy(false);
      setErr(error);
      return;
    }
    if (data?.url) {
      window.location.assign(data.url); // halaman bayar DOKU
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const kartu = (aktif: boolean) =>
    cn(
      "cursor-pointer rounded-[4px] border-2 px-2 py-2 text-center transition-transform",
      aktif
        ? "border-kongsi-ink bg-kongsi-parchment text-kongsi-ink shadow-hard-sm"
        : "border-kongsi-parchment/60 bg-kongsi-grenadine-dark text-kongsi-parchment",
    );
  const judulBagian = "mt-3 text-[11px] font-bold uppercase tracking-[1.5px] opacity-85";

  return (
    <div id="isi-pundi" className="relative z-10 mt-[14px]">
      {saran ? (
        <div className="mb-2 rounded-[4px] border-2 border-kongsi-ink bg-kongsi-beeswax px-3 py-2 text-[12px] font-semibold text-kongsi-ink">
          Saldo kurang untuk tukar — nominal Rp {saran.toLocaleString("id-ID")} sudah kami isikan. Boleh diubah.
        </div>
      ) : null}

      <div className="text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">Isi Pundi (untuk Tukar Guling)</div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {NOMINAL_CEPAT.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setPick(String(n));
              setLain("");
            }}
            aria-pressed={pick === String(n)}
            className={kartu(pick === String(n))}
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

      {mode === "doku" ? (
        <>
          <div className={judulBagian}>Bayar pakai</div>
          <div className="mt-2 text-kongsi-ink">
            <PilihMetode ringkas neto={nominal ?? 0} value={metode} onChange={setMetode} />
          </div>
        </>
      ) : null}

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
            : nominal
              ? `Isi ${nominal.toLocaleString("id-ID")} Keteng — bayar Rp ${(tagihan?.total ?? nominal).toLocaleString("id-ID")}${mode === "demo" ? " (demo)" : ""}`
              : "Pilih atau isi nominal"}
      </button>
      {err || (pick === lain && lain && salah) ? (
        <div className="mt-2 text-[12px] font-semibold">{err ?? salah}</div>
      ) : null}
      <p className="mt-2 text-[11px] opacity-80">
        {tagihan ? `Termasuk biaya pembayaran Rp ${tagihan.biaya.toLocaleString("id-ID")} (potongan DOKU + PPN). ` : ""}
        Keteng hanya untuk Tukar Guling (bea, tambah Keteng, ongkir) dan tidak dapat diuangkan kembali. Belanja e-voucher
        dibayar langsung tanpa Keteng.
      </p>
    </div>
  );
}

export function BayarTiruan({ invoice, kembali }: { invoice: string; kembali: string }) {
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
          else router.push(kembali);
        }}
        className="inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-[22px] py-3 text-sm font-bold text-kongsi-parchment shadow-hard disabled:opacity-60"
      >
        {busy ? "Memproses…" : "Bayar (simulasi sukses)"}
      </button>
      {err ? <p className="mt-2 text-[12px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
