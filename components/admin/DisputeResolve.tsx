"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { putusSengketa } from "@/app/actions/tukar";
import { cn } from "@/lib/utils";

export function DisputeResolve({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function resolve(next: "selesai" | "batal") {
    setBusy(true);
    await putusSengketa(id, next);
    setBusy(false);
    router.refresh();
  }

  const btn = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-xs font-bold disabled:opacity-60";

  return (
    <div className="flex gap-2">
      <button type="button" disabled={busy} onClick={() => resolve("selesai")} className={cn(btn, "bg-kongsi-sage")}>
        Sahkan (selesai)
      </button>
      <button type="button" disabled={busy} onClick={() => resolve("batal")} className={cn(btn, "bg-kongsi-parchment-3 text-kongsi-bad")}>
        Batalkan
      </button>
    </div>
  );
}
