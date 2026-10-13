"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buatSetoranLapak, kembalikanVoucherLapak, putusKomplainVoucher } from "@/app/actions/admin";
import { cn, formatKeping } from "@/lib/utils";

const tombol = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-[12px] font-bold disabled:opacity-60";
const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-3 py-[6px] text-[12px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";
const masukan = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[12px]";

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
    return !error;
  }
  return { busy, err, jalankan };
}

export function BuatSetoran({ merchantId, nominal, siap }: { merchantId: string; nominal: number; siap: boolean }) {
  const { busy, err, jalankan } = useJalankan();
  return (
    <div>
      <button
        type="button"
        disabled={busy || !siap}
        onClick={() => confirm(`Buat setoran ${formatKeping(nominal)}? Masuk antrian Transfer Keluar.`) && jalankan(() => buatSetoranLapak(merchantId))}
        className={cn(tombol, "bg-kongsi-grenadine text-kongsi-parchment")}
      >
        {busy ? "…" : "Buat setoran"}
      </button>
      {err ? <p className="mt-1 text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}

export function PutusKomplain({ id }: { id: string }) {
  const { busy, err, jalankan } = useJalankan();
  const [k, setK] = useState<"terima" | "tolak" | null>(null);
  const [alasan, setAlasan] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { v: "terima", l: "Terima — kembalikan uang" },
            { v: "tolak", l: "Tolak" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={k === o.v}
            onClick={() => setK(o.v)}
            className={cn(pilihan, k === o.v ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment hover:bg-kongsi-beeswax")}
          >
            {o.l}
          </button>
        ))}
      </div>
      <textarea rows={2} value={alasan} maxLength={500} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan (wajib)" aria-label="Alasan" className={masukan} />
      <button
        type="button"
        disabled={busy || !k || alasan.trim().length < 10}
        onClick={() =>
          confirm(k === "terima" ? "Terima laporan? Uang pembeli kembali utuh, lapak dipotong biaya." : "Tolak laporan?") &&
          jalankan(() => putusKomplainVoucher(id, k!, alasan))
        }
        className={cn(tombol, "w-full bg-kongsi-indigo text-kongsi-parchment")}
      >
        {busy ? "Memutus…" : "Putuskan"}
      </button>
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}

export function KembalikanVoucher() {
  const { busy, err, jalankan } = useJalankan();
  const [kode, setKode] = useState("");
  const [alasan, setAlasan] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <div className="max-w-md space-y-2 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm">
      <input value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())} placeholder="KODE-VOUCHER" aria-label="Kode voucher" maxLength={11} className={masukan} />
      <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan (mis. cabang Jakal tutup permanen)" aria-label="Alasan" maxLength={300} className={masukan} />
      <button
        type="button"
        disabled={busy || kode.replace(/[^0-9A-Z]/g, "").length !== 10 || alasan.trim().length < 10}
        onClick={async () => {
          if (!confirm("Kembalikan uang pembeli voucher ini? Tidak bisa dibatalkan.")) return;
          setOk(false);
          if (await jalankan(() => kembalikanVoucherLapak(kode, alasan))) {
            setOk(true);
            setKode("");
            setAlasan("");
          }
        }}
        className={cn(tombol, "w-full bg-kongsi-grenadine text-kongsi-parchment")}
      >
        {busy ? "Memproses…" : "Kembalikan uang pembeli"}
      </button>
      {ok ? <p className="text-[12px] font-bold text-kongsi-ok">✓ Masuk antrian Transfer Keluar.</p> : null}
      {err ? <p className="text-[12px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
