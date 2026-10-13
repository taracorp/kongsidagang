"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { putusSengketa } from "@/app/actions/tukar";
import { cn } from "@/lib/utils";

const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-3 py-[6px] text-[12px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";
const on = "bg-kongsi-grenadine text-kongsi-parchment";
const off = "bg-kongsi-parchment hover:bg-kongsi-beeswax";

/**
 * Putusan Syahbandar: Sah (tukar jadi) / Batal + pihak bersalah + alasan wajib. Pihak bersalah: bea-nya hangus (bila
 * batal), menanggung biaya pengembalian selisih, dan mendapat catatan pelanggaran. Tanpa ganti rugi antar-user.
 */
export function DisputeResolve({ id, saran }: { id: string; saran: "a" | "b" | null }) {
  const router = useRouter();
  const [keputusan, setKeputusan] = useState<"sah" | "batal" | null>(null);
  const [bersalah, setBersalah] = useState<"a" | "b" | null>(saran);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function kirim() {
    if (!keputusan) return;
    const teks =
      keputusan === "sah"
        ? `Sahkan tukar (selisih diteruskan ke penerima)${bersalah ? `, catat pihak ${bersalah.toUpperCase()} bersalah` : ""}?`
        : `Batalkan tukar${bersalah ? `, pihak ${bersalah.toUpperCase()} bersalah (bea hangus)` : " tanpa pihak bersalah"}?`;
    if (!confirm(`${teks}\nPutusan tidak bisa diubah.`)) return;
    setBusy(true);
    setErr(null);
    const { error } = await putusSengketa(id, keputusan, bersalah, alasan);
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "sah", l: "Sah (tukar jadi)" },
            { v: "batal", l: "Batal" },
          ] as const
        ).map((o) => (
          <button key={o.v} type="button" aria-pressed={keputusan === o.v} onClick={() => setKeputusan(o.v)} className={cn(pilihan, keputusan === o.v ? on : off)}>
            {o.l}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "a", l: "A bersalah" },
            { v: "b", l: "B bersalah" },
            { v: null, l: "Tidak ada" },
          ] as const
        ).map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={bersalah === o.v} onClick={() => setBersalah(o.v)} className={cn(pilihan, bersalah === o.v ? on : off)}>
            {o.l}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={alasan}
        maxLength={500}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="Alasan putusan (wajib, tampil ke kedua pihak)"
        aria-label="Alasan putusan"
        className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]"
      />
      <button
        type="button"
        disabled={busy || !keputusan || alasan.trim().length < 10}
        onClick={kirim}
        className="w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-indigo px-3 py-1 text-xs font-bold text-kongsi-parchment disabled:opacity-60"
      >
        {busy ? "Memutus…" : "Putuskan"}
      </button>
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
