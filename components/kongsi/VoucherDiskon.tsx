"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { klaimVoucherDiskon } from "@/app/actions/belanja";
import { cn, formatKeping } from "@/lib/utils";

type V = { id: string; nama: string; jenis: string; nilai: number; maksPotongan: number | null; kode: string | null; minBelanja: number; pembuat: string; diklaim: boolean };

/** Kartu voucher diskon yang bisa diklaim pembeli di halaman lapak. */
export function VoucherDiskon({ v, loggedIn }: { v: V; loggedIn: boolean }) {
  const router = useRouter();
  const [diklaim, setDiklaim] = useState(v.diklaim);
  const [busy, setBusy] = useState(false);
  const nilai = v.jenis === "persen" ? `${v.nilai}%${v.maksPotongan ? ` s/d ${formatKeping(v.maksPotongan)}` : ""}` : formatKeping(v.nilai);

  async function klaim() {
    if (!loggedIn) return router.push("/masuk");
    setBusy(true);
    const { error } = await klaimVoucherDiskon(v.kode ?? v.id);
    setBusy(false);
    if (!error) setDiklaim(true);
  }

  return (
    <div className="flex min-w-[180px] flex-col gap-1 rounded-[6px] border-2 border-dashed border-kongsi-grenadine bg-kongsi-parchment-3 p-3 text-[12px]">
      <div className="flex items-center justify-between gap-2">
        <b className="font-fraunces text-[15px] text-kongsi-grenadine">{nilai}</b>
        <span className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">{v.pembuat === "platform" ? "Kongsi" : "Lapak"}</span>
      </div>
      <div className="font-bold">{v.nama}</div>
      {v.minBelanja ? <div className="text-kongsi-ink-soft">min. belanja {formatKeping(v.minBelanja)}</div> : null}
      <button
        type="button"
        disabled={busy || diklaim}
        onClick={klaim}
        className={cn("mt-1 cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-1 font-bold disabled:opacity-70", diklaim ? "bg-kongsi-sage" : "bg-kongsi-grenadine text-kongsi-parchment")}
      >
        {diklaim ? "✓ Terklaim" : busy ? "…" : "Klaim"}
      </button>
    </div>
  );
}
