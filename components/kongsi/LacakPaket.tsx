"use client";

import { useState } from "react";
import { lacakPaketTukar } from "@/app/actions/tukar";
import type { Lacakan } from "@/lib/shipping/kiriminaja";

/** Lacak paket Tukar Guling (endpoint tracking KiriminAja), riwayat ditampilkan di tempat. */
export function LacakPaket({ shipmentId }: { shipmentId: string }) {
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<Lacakan | string | null>(null);
  async function lacak() {
    setBusy(true);
    const { error, data } = await lacakPaketTukar(shipmentId);
    setBusy(false);
    setHasil(error ?? data!);
  }
  return (
    <div className="w-full">
      <button type="button" onClick={lacak} disabled={busy} className="cursor-pointer font-bold text-kongsi-grenadine disabled:opacity-60">
        {busy ? "Melacak…" : "Lacak paket"}
      </button>
      {typeof hasil === "string" ? <p className="mt-1 text-kongsi-bad">{hasil}</p> : null}
      {hasil && typeof hasil !== "string" ? (
        <div className="mt-1 rounded-[4px] border-[1.5px] border-kongsi-ink/30 bg-kongsi-parchment p-2">
          <b>{hasil.text}</b>
          <ul className="mt-1 list-disc pl-4">
            {hasil.histories.map((h, i) => (
              <li key={i}>
                {h.at ?? ""} — {h.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
