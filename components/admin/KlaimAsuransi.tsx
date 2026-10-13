"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { catatKlaimAsuransi, klaimAsuransiCair, klaimAsuransiDitolak } from "@/app/actions/admin";
import { cn, formatKeping } from "@/lib/utils";

const masukan = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]";
const tombol = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-[12px] font-bold disabled:opacity-60";
const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-2 py-[4px] text-[12px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";

function useJalankan() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function jalankan(f: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setErr(null);
    const { error } = await f();
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }
  return { busy, err, jalankan };
}

/** Catat klaim untuk paket bermasalah. */
export function CatatKlaim({ shipmentId }: { shipmentId: string }) {
  const { busy, err, jalankan } = useJalankan();
  const [nomor, setNomor] = useState("");
  const [jenis, setJenis] = useState<"hilang" | "rusak">("hilang");
  const [penerima, setPenerima] = useState<"pengirim" | "penerima">("pengirim");
  const chip = (aktif: boolean) => cn(pilihan, aktif ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment hover:bg-kongsi-beeswax");
  return (
    <div className="space-y-2">
      <input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="No. klaim KiriminAja" aria-label="Nomor klaim" className={masukan} />
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={jenis === "hilang"} onClick={() => setJenis("hilang")} className={chip(jenis === "hilang")}>Hilang</button>
        <button type="button" aria-pressed={jenis === "rusak"} onClick={() => setJenis("rusak")} className={chip(jenis === "rusak")}>Rusak</button>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" aria-pressed={penerima === "pengirim"} onClick={() => setPenerima("pengirim")} className={chip(penerima === "pengirim")}>Untuk pemilik barang</button>
        <button type="button" aria-pressed={penerima === "penerima"} onClick={() => setPenerima("penerima")} className={chip(penerima === "penerima")}>Untuk penerima paket</button>
      </div>
      <button type="button" disabled={busy || nomor.trim().length < 3} onClick={() => jalankan(() => catatKlaimAsuransi(shipmentId, nomor, jenis, penerima))} className={cn(tombol, "w-full bg-kongsi-grenadine text-kongsi-parchment")}>
        {busy ? "…" : "Catat klaim"}
      </button>
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}

/** Klaim berjalan: cair (nominal diterima) atau ditolak. */
export function PutusKlaim({ id }: { id: string }) {
  const { busy, err, jalankan } = useJalankan();
  const [nominal, setNominal] = useState("");
  const [alasan, setAlasan] = useState("");
  const n = Number(nominal.replace(/\D/g, "")) || 0;
  return (
    <div className="space-y-2">
      <input inputMode="numeric" value={nominal ? n.toLocaleString("id-ID") : ""} onChange={(e) => setNominal(e.target.value)} placeholder="Nominal cair dari kurir" aria-label="Nominal cair" className={masukan} />
      <button
        type="button"
        disabled={busy || n <= 2_500}
        onClick={() => confirm(`Klaim cair ${formatKeping(n)}? Diteruskan ke penerima dipotong biaya transfer.`) && jalankan(() => klaimAsuransiCair(id, n))}
        className={cn(tombol, "w-full bg-kongsi-sage")}
      >
        Klaim cair → transfer
      </button>
      <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan ditolak kurir" aria-label="Alasan ditolak" className={masukan} />
      <button
        type="button"
        disabled={busy || alasan.trim().length < 10}
        onClick={() => confirm("Klaim ditolak kurir? Kongsi tidak mengganti.") && jalankan(() => klaimAsuransiDitolak(id, alasan))}
        className={cn(tombol, "w-full bg-kongsi-parchment-3 text-kongsi-bad")}
      >
        Klaim ditolak
      </button>
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
