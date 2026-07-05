"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const options = [
  "kumpul",
  "tebak",
  "jeda",
  "final",
  "pemenang",
  "bayar",
  "selesai",
];

export function AuctionStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function onChange(next: string) {
    setValue(next);
    setBusy(true);
    const supabase = createClient();
    await supabase.from("auctions").update({ status: next }).eq("id", id);

    // Beri sinyal ke semua penonton /lelang (Realtime Broadcast).
    const ch = supabase.channel("kongsi-lelang");
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "update", payload: {} }).finally(
          () => supabase.removeChannel(ch),
        );
      }
    });

    setBusy(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-xs font-bold"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
