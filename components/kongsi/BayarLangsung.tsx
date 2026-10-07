"use client";

import { useState } from "react";
import { bayarLangsung } from "@/app/actions/pundi";
import type { CaraBayar, Tujuan } from "@/lib/domain/bayar-langsung";
import { rincianBayar, METODE_AWAL } from "@/lib/payment/biaya";
import { nominalLangsung, tautanIsi } from "@/lib/pundi-paket";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";
import { PilihMetode } from "./PilihMetode";

/**
 * Bayar Langsung untuk Tukar Guling (Keteng hanya berlaku untuk barter): beli Keteng yang kurang lewat DOKU
 * tanpa Isi Pundi dulu, lalu aksinya dijalankan otomatis. Pembeli menanggung biaya pembayaran metode pilihannya.
 * Saldo 0 → satu tombol. Saldo sebagian → "pakai saldo + beli kekurangan" atau "beli penuh".
 * Angka di tombol hanya perkiraan; server menghitung ulang dari kebutuhan & saldo terkini.
 * `kebutuhan` null = belum bisa dihitung di browser (mis. ongkir kurir) → tombol tanpa angka.
 */
export function BayarLangsung({
  tujuan,
  muatan,
  kebutuhan,
  saldo,
  tersedia = true,
  disabled,
  kecil,
}: {
  tujuan: Tujuan;
  muatan: unknown;
  kebutuhan: number | null;
  saldo: number;
  tersedia?: boolean;
  disabled?: boolean;
  kecil?: boolean; // tombol ringkas (lembar Ajukan Tukar)
}) {
  const [metode, setMetode] = useState(METODE_AWAL);
  const [busy, setBusy] = useState<CaraBayar | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!tersedia) {
    const kurang = kebutuhan != null ? kebutuhan - saldo : 0;
    return (
      <a href={tautanIsi(kurang)} className="font-bold text-kongsi-grenadine underline">
        Saldo kurang — Isi Pundi
      </a>
    );
  }

  async function bayar(cara: CaraBayar) {
    setBusy(cara);
    setErr(null);
    const { error, data } = await bayarLangsung(tujuan, muatan, cara, metode);
    if (error || !data) {
      setBusy(null);
      setErr(error ?? "Gagal membuka pembayaran.");
      return;
    }
    window.location.assign(data.url); // halaman bayar DOKU (atau halaman hasil pada mode demo)
  }

  const sebagian = saldo > 0;
  const keteng = (cara: CaraBayar) => (kebutuhan != null ? nominalLangsung(kebutuhan, saldo, cara) : null);
  const label = (cara: CaraBayar) => {
    const k = keteng(cara);
    if (k == null) return cara === "kurang" ? "Pakai saldo + bayar kekurangannya" : "Bayar penuh";
    const bayarRp = formatKeping(rincianBayar(k, metode).total);
    return cara === "kurang" && sebagian ? `Pakai saldo ${formatKeping(saldo)} + bayar ${bayarRp}` : `Bayar ${bayarRp}`;
  };
  const kecilCls =
    "block w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-center text-[12px] font-bold disabled:opacity-60";

  const tombolBayar = (cara: CaraBayar, utama: boolean) =>
    kecil ? (
      <button
        key={cara}
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => bayar(cara)}
        className={cn(kecilCls, utama ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment-3")}
      >
        {busy === cara ? "Membuka pembayaran…" : label(cara)}
      </button>
    ) : (
      <KongsiButton
        key={cara}
        type="button"
        variant={utama ? "primary" : "ghost"}
        block
        disabled={disabled || busy !== null}
        onClick={() => bayar(cara)}
      >
        {busy === cara ? "Membuka pembayaran…" : label(cara)}
      </KongsiButton>
    );

  const kNeto = keteng(sebagian ? "kurang" : "penuh") ?? 0;
  return (
    <div className="space-y-2">
      <PilihMetode ringkas neto={kNeto} value={metode} onChange={setMetode} />
      {sebagian ? [tombolBayar("kurang", true), tombolBayar("penuh", false)] : tombolBayar("penuh", true)}
      <p className="text-[11px] text-kongsi-ink-soft">
        Yang kamu bayar dibelikan Keteng (1 Rupiah = 1 Keteng, minimal 10.000) lalu langsung dipakai untuk tukar ini,
        ditambah biaya pembayaran metode pilihanmu. Sisa pembulatan tetap di Pundi-mu.
      </p>
      {err ? (
        <p className="rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}
    </div>
  );
}
