"use client";

import { useState } from "react";
import { bayarLangsung } from "@/app/actions/pundi";
import type { CaraBayar, Tujuan } from "@/lib/domain/bayar-langsung";
import { nominalLangsung, tautanIsi } from "@/lib/pundi-paket";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";

/**
 * Bayar Langsung (QRIS / VA / e-wallet lewat DOKU) tanpa Isi Pundi dulu.
 * Saldo 0 → satu tombol bayar penuh. Saldo sebagian → pilih "pakai saldo + bayar kekurangan" atau "bayar penuh".
 * Nominal di tombol hanya perkiraan; server menghitung ulang dari harga & saldo terkini.
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
    const { error, data } = await bayarLangsung(tujuan, muatan, cara);
    if (error || !data) {
      setBusy(null);
      setErr(error ?? "Gagal membuka pembayaran.");
      return;
    }
    window.location.assign(data.url); // halaman bayar DOKU (atau halaman hasil pada mode demo)
  }

  const sebagian = saldo > 0;
  const nKurang = kebutuhan != null ? nominalLangsung(kebutuhan, saldo, "kurang") : null;
  const nPenuh = kebutuhan != null ? nominalLangsung(kebutuhan, saldo, "penuh") : null;
  const rp = (n: number | null) => (n != null ? ` ${formatKeping(n)}` : "");
  const tombol = kecil
    ? "block w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[6px] text-center text-[12px] font-bold disabled:opacity-60"
    : "";

  const tombolBayar = (cara: CaraBayar, utama: boolean, label: string) =>
    kecil ? (
      <button
        key={cara}
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => bayar(cara)}
        className={cn(tombol, utama ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment-3")}
      >
        {busy === cara ? "Membuka pembayaran…" : label}
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
        {busy === cara ? "Membuka pembayaran…" : label}
      </KongsiButton>
    );

  return (
    <div className="space-y-2">
      {sebagian
        ? [
            tombolBayar("kurang", true, `Pakai saldo ${formatKeping(saldo)} + bayar${rp(nKurang)}`),
            tombolBayar("penuh", false, `Bayar penuh${rp(nPenuh)}`),
          ]
        : tombolBayar("penuh", true, `Bayar${rp(nPenuh)} — QRIS / VA / e-wallet`)}
      <p className="text-[11px] text-kongsi-ink-soft">
        Uang yang kamu bayar otomatis jadi Keteng (1 Rupiah = 1 Keteng) lalu langsung dipakai. Pembayaran minimal
        Rp10.000; sisa pembulatan tetap di Pundi-mu.
      </p>
      {err ? (
        <p className="rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}
    </div>
  );
}
