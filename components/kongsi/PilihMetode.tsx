"use client";

import { METODE_AKTIF as METODE, NAMA_GRUP, rincianBayar, type GrupMetode } from "@/lib/payment/biaya";
import { cn, formatKeping } from "@/lib/utils";

const GRUP: GrupMetode[] = (["qris", "va", "ewallet", "kartu"] as GrupMetode[]).filter((g) => METODE.some((m) => m.grup === g));
// Tombol pilihan = pola .jt-chip (kotak, border tebal, bayangan keras) — sama dengan TawarkanForm.
const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-3 py-[10px] shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";
const pilihanOn = "bg-kongsi-grenadine text-kongsi-parchment";
const pilihanOff = "bg-kongsi-parchment text-kongsi-ink hover:bg-kongsi-beeswax";
const masukan =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

/**
 * Pilih metode pembayaran DOKU. Tiap metode menampilkan biaya pembayarannya (ditanggung pembeli) untuk `neto`
 * — nominal bersih yang harus diterima Kongsi. `ringkas` = dropdown (untuk lembar sempit).
 */
export function PilihMetode({
  neto,
  value,
  onChange,
  ringkas,
}: {
  neto: number;
  value: string;
  onChange: (kode: string) => void;
  ringkas?: boolean;
}) {
  const biaya = (kode: string) => (neto > 0 ? rincianBayar(neto, kode).biaya : 0);

  if (ringkas) {
    return (
      <select aria-label="Metode pembayaran" value={value} onChange={(e) => onChange(e.target.value)} className={masukan}>
        {GRUP.map((g) => (
          <optgroup key={g} label={NAMA_GRUP[g]}>
            {METODE.filter((m) => m.grup === g).map((m) => (
              <option key={m.kode} value={m.kode}>
                {m.nama} · biaya {formatKeping(biaya(m.kode))}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }

  return (
    <div role="radiogroup" aria-label="Metode pembayaran" className="space-y-3">
      {GRUP.map((g) => (
        <div key={g}>
          <div className="mb-[6px] text-[11px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">{NAMA_GRUP[g]}</div>
          <div className={cn("grid gap-2", g === "va" || g === "ewallet" ? "grid-cols-2" : "grid-cols-1")}>
            {METODE.filter((m) => m.grup === g).map((m) => {
              const aktif = m.kode === value;
              return (
                <button
                  key={m.kode}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  onClick={() => onChange(m.kode)}
                  className={cn(pilihan, "flex flex-wrap items-center justify-between gap-x-2 text-left text-[13px]", aktif ? pilihanOn : pilihanOff)}
                >
                  <span className="font-bold">{m.nama}</span>
                  <span className={cn("whitespace-nowrap text-[12px]", aktif ? "text-kongsi-parchment" : "text-kongsi-ink-soft")}>
                    +{formatKeping(biaya(m.kode))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-kongsi-ink-soft">
        Biaya pembayaran adalah potongan DOKU (termasuk PPN 11%) untuk metode yang kamu pilih.
      </p>
    </div>
  );
}
