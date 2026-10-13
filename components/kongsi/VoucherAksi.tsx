"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { laporkanVoucher, pindahCabangVoucher } from "@/app/actions/belanja";
import { cn } from "@/lib/utils";

const kecil = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[4px] text-[12px] font-bold disabled:opacity-60";
const masukan = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]";

/** Aksi pembeli atas Surat Jalan lapak: pindah cabang (gratis) dan laporkan masalah ke Kongsi. */
export function VoucherAksi({
  id,
  cabangLain,
  bisaLapor,
  komplain,
}: {
  id: string;
  cabangLain: { id: string; name: string }[];
  bisaLapor: boolean;
  komplain: string | null;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState<null | "pindah" | "lapor">(null);
  const [cabang, setCabang] = useState(cabangLain[0]?.id ?? "");
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function jalankan(f: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setErr(null);
    const { error } = await f();
    setBusy(false);
    if (error) return setErr(error);
    setBuka(null);
    router.refresh();
  }

  if (komplain === "terbuka") return <p className="mt-1 text-[11px] font-bold text-kongsi-grenadine">Laporanmu sedang diperiksa Kongsi.</p>;
  if (!cabangLain.length && !bisaLapor) return null;
  return (
    <div className="mt-2 text-[12px]">
      {!buka ? (
        <div className="flex flex-wrap gap-2">
          {cabangLain.length ? (
            <button type="button" className={cn(kecil, "bg-kongsi-parchment")} onClick={() => setBuka("pindah")}>
              Pindah cabang
            </button>
          ) : null}
          {bisaLapor ? (
            <button type="button" className={cn(kecil, "bg-kongsi-parchment text-kongsi-bad")} onClick={() => setBuka("lapor")}>
              Laporkan masalah
            </button>
          ) : null}
        </div>
      ) : buka === "pindah" ? (
        <div className="space-y-2">
          <select value={cabang} onChange={(e) => setCabang(e.target.value)} aria-label="Cabang tujuan" className={masukan}>
            {cabangLain.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className={cn(kecil, "bg-kongsi-parchment")} onClick={() => setBuka(null)}>
              Batal
            </button>
            <button type="button" disabled={busy || !cabang} className={cn(kecil, "flex-1 bg-kongsi-grenadine text-kongsi-parchment")} onClick={() => jalankan(() => pindahCabangVoucher(id, cabang))}>
              {busy ? "…" : "Pindahkan (gratis)"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            maxLength={500}
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="cth. cabang tutup / petugas menolak / sudah ditebus tapi belum dilayani"
            aria-label="Masalahnya"
            className={masukan}
          />
          <p className="text-[11px] text-kongsi-ink-soft">
            Kongsi memeriksa. Bila lapak terbukti tidak melayani, uangmu kembali utuh ke rekening (isi di Pakhuis → Rekening).
          </p>
          <div className="flex gap-2">
            <button type="button" className={cn(kecil, "bg-kongsi-parchment")} onClick={() => setBuka(null)}>
              Batal
            </button>
            <button type="button" disabled={busy || alasan.trim().length < 10} className={cn(kecil, "flex-1 bg-kongsi-grenadine text-kongsi-parchment")} onClick={() => jalankan(() => laporkanVoucher(id, alasan))}>
              {busy ? "…" : "Kirim laporan"}
            </button>
          </div>
        </div>
      )}
      {err ? <p className="mt-1 text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
