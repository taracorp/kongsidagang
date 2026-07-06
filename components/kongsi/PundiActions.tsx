"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function IsiPundiButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("topup_demo", { amt: 100000 });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-[14px] inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-[22px] py-3 text-sm font-bold text-kongsi-ink shadow-hard transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm disabled:opacity-60"
    >
      {busy ? "Mengisi…" : "Isi Pundi +Rp 100.000 (demo)"}
    </button>
  );
}

export function VoucherRedeem({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("redeem_voucher", { vid: id });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="cursor-pointer rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-beeswax px-[9px] py-[3px] text-[11px] font-bold uppercase tracking-[0.6px] text-kongsi-ink disabled:opacity-60"
      >
        {busy ? "…" : "Tebus"}
      </button>
      {err ? <div className="mt-1 text-[10px] text-kongsi-bad">{err}</div> : null}
    </div>
  );
}
