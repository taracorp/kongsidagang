"use client";

import { useState } from "react";
import { bayarLangsung } from "@/app/actions/pundi";
import type { CaraBayar, Tujuan } from "@/lib/domain/bayar-langsung";
import { rincianBayar, METODE_AWAL_KETENG, METODE_SELISIH } from "@/lib/payment/biaya";
import { ketengDibeli, tautanIsi } from "@/lib/pundi-paket";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";
import { PilihMetode } from "./PilihMetode";

/**
 * Bayar Langsung untuk Tukar Guling lewat DOKU, tanpa Isi Pundi dulu; aksinya dijalankan otomatis setelah lunas.
 * - `kebutuhan` = Keteng jaminan yang perlu ditahan; kekurangannya dibelikan Keteng (1 Rupiah = 1 Keteng).
 * - `uang` = selisih tukar + biaya transfer (uang rekber, BUKAN Keteng) — hanya QRIS / Virtual Account.
 * Saldo sebagian → "pakai saldo + bayar kekurangan" atau "bayar penuh". Angka di tombol hanya perkiraan; server
 * menghitung ulang. `kebutuhan` null = belum bisa dihitung di browser (mis. ongkir kurir) → tombol tanpa angka.
 */
export function BayarLangsung({
  tujuan,
  muatan,
  kebutuhan,
  saldo,
  uang = 0,
  tersedia = true,
  disabled,
  kecil,
}: {
  tujuan: Tujuan;
  muatan: unknown;
  kebutuhan: number | null;
  saldo: number;
  uang?: number;
  tersedia?: boolean;
  disabled?: boolean;
  kecil?: boolean; // tombol ringkas
}) {
  const adaUang = uang > 0;
  const [metode, setMetode] = useState(adaUang ? (METODE_SELISIH[0]?.kode ?? METODE_AWAL_KETENG) : METODE_AWAL_KETENG);
  const [busy, setBusy] = useState<CaraBayar | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!tersedia) {
    const kurang = kebutuhan != null ? kebutuhan - saldo : 0;
    return (
      <a href={tautanIsi(kurang)} className="font-bold text-kongsi-grenadine underline">
        Pembayaran belum tersedia — Isi Pundi
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

  const sebagian = saldo > 0 && (kebutuhan ?? 1) > 0;
  const keteng = (cara: CaraBayar) => (kebutuhan != null ? ketengDibeli(kebutuhan, saldo, cara, uang) : null);
  const label = (cara: CaraBayar) => {
    const k = keteng(cara);
    if (k == null) return cara === "kurang" ? "Pakai saldo + bayar kekurangannya" : "Bayar penuh";
    const bayarRp = formatKeping(rincianBayar(k + uang, metode).total);
    // Tampilkan saldo yang benar-benar terpakai (bukan seluruh saldo).
    const terpakai = Math.min(saldo, kebutuhan ?? 0);
    return cara === "kurang" && sebagian ? `Pakai saldo ${formatKeping(terpakai)} + bayar ${bayarRp}` : `Bayar ${bayarRp}`;
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

  const kNeto = (keteng(sebagian ? "kurang" : "penuh") ?? 0) + uang;
  return (
    <div className="space-y-2">
      <PilihMetode ringkas keteng selisih={adaUang} neto={kNeto} value={metode} onChange={setMetode} />
      {sebagian ? [tombolBayar("kurang", true), tombolBayar("penuh", false)] : tombolBayar("penuh", true)}
      <p className="text-[11px] text-kongsi-ink-soft">
        {adaUang
          ? `Selisih ${formatKeping(uang)} (termasuk biaya transfer pencairan) ditahan Kongsi sebagai uang — diteruskan ke rekening lawan saat tukar selesai, kembali ke rekeningmu bila batal. `
          : ""}
        Jaminan yang kurang dibelikan Keteng (1 Rupiah = 1 Keteng) lalu langsung ditahan, ditambah biaya pembayaran
        metode pilihanmu. Sisa pembulatan tetap di Pundi-mu.
      </p>
      {err ? (
        <p className="rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}
    </div>
  );
}
