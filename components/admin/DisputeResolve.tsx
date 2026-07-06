"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function DisputeResolve({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resolve(next: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("barter_deals").update({ status: next }).eq("id", id);
    setBusy(false);
    router.refresh();
  }

  const btn = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-xs font-bold disabled:opacity-60";

  return (
    <div className="flex gap-2">
      <button type="button" disabled={busy} onClick={() => resolve("done")} className={cn(btn, "bg-kongsi-sage")}>
        Sahkan (selesai)
      </button>
      <button type="button" disabled={busy} onClick={() => resolve("dibatalkan")} className={cn(btn, "bg-kongsi-parchment-3 text-kongsi-bad")}>
        Batalkan
      </button>
    </div>
  );
}
