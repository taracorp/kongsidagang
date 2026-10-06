"use client";

import { useState } from "react";
import { tebusVoucherKantor } from "@/app/actions/belanja";
import { cn } from "@/lib/utils";

/** Admin menebus Surat Jalan hadiah lelang (voucher tanpa lapak). */
export function TebusVoucherKantor() {
  const [kode, setKode] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<{ ok: boolean; teks: string } | null>(null);

  async function tebus(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setHasil(null);
    const { error, data } = await tebusVoucherKantor(kode);
    setBusy(false);
    if (error) return setHasil({ ok: false, teks: error });
    setKode("");
    setHasil({ ok: true, teks: `✓ ${data?.title} — atas nama ${data?.pemilik} (${data?.kode})` });
  }

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm">
      <h3 className="mb-2 font-fraunces text-lg font-black text-kongsi-indigo">Tebus Surat Jalan hadiah lelang</h3>
      <form onSubmit={tebus} className="flex gap-2">
        <input
          value={kode}
          onChange={(e) => setKode(e.target.value.toUpperCase())}
          placeholder="KODE-VOUCHER"
          maxLength={11}
          aria-label="Kode voucher lelang"
          className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 font-fraunces text-lg tracking-[3px]"
        />
        <button
          type="submit"
          disabled={busy || kode.replace(/[^0-9A-Z]/g, "").length !== 10}
          className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-4 text-sm font-bold text-kongsi-parchment disabled:opacity-60"
        >
          {busy ? "…" : "Tebus"}
        </button>
      </form>
      {hasil ? (
        <p
          className={cn(
            "mt-2 rounded-[4px] border-2 px-3 py-2 text-[13px] font-semibold",
            hasil.ok ? "border-kongsi-ok bg-kongsi-sage/30 text-kongsi-ok" : "border-kongsi-grenadine bg-kongsi-parchment-3 text-kongsi-grenadine-dark",
          )}
        >
          {hasil.teks}
        </p>
      ) : null}
    </div>
  );
}
