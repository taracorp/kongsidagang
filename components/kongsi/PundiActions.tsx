"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isiPundiDemo, tebusSuratJalan } from "@/app/actions/pundi";
import { TOPUP_PACKAGES } from "@/lib/pundi-paket";
import { cn } from "@/lib/utils";

const rb = (n: number) => `${(n / 1000).toLocaleString("id-ID")}rb`;

export function IsiPundiPaket() {
  const router = useRouter();
  const [pick, setPick] = useState(TOPUP_PACKAGES[2].id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pkg = TOPUP_PACKAGES.find((p) => p.id === pick)!;

  async function onClick() {
    setBusy(true);
    setErr(null);
    const { error } = await isiPundiDemo(pick);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative z-10 mt-[14px]">
      <div className="text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">
        Isi Pundi — pilih paket
      </div>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {TOPUP_PACKAGES.map((p) => {
          const bonus = p.keteng - p.price;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPick(p.id)}
              aria-pressed={pick === p.id}
              className={cn(
                "cursor-pointer rounded-[4px] border-2 px-2 py-2 text-left transition-transform",
                pick === p.id
                  ? "border-kongsi-ink bg-kongsi-parchment text-kongsi-ink shadow-hard-sm"
                  : "border-kongsi-parchment/60 bg-kongsi-grenadine-dark text-kongsi-parchment",
              )}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.6px]">{p.name}</div>
              <div className="font-fraunces text-lg font-black leading-tight">{rb(p.keteng)}</div>
              <div className="text-[11px] opacity-80">bayar Rp {p.price.toLocaleString("id-ID")}</div>
              {bonus > 0 ? (
                <b className="mt-1 inline-block rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-beeswax px-[6px] text-[10px] text-kongsi-ink">
                  bonus +{rb(bonus)}
                </b>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mt-[12px] inline-block cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-[22px] py-3 text-sm font-bold text-kongsi-ink shadow-hard transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm disabled:opacity-60"
      >
        {busy
          ? "Mengisi…"
          : `Isi ${pkg.keteng.toLocaleString("id-ID")} Keteng — Rp ${pkg.price.toLocaleString("id-ID")} (demo)`}
      </button>
      {err ? <div className="mt-2 text-[12px] font-semibold">{err}</div> : null}
      <p className="mt-2 text-[11px] opacity-80">
        Keteng tidak dapat diuangkan kembali — dipakai untuk belanja, bea Tukar Guling, & lelang.
      </p>
    </div>
  );
}

export function VoucherRedeem({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    const { error } = await tebusSuratJalan(id);
    setBusy(false);
    if (error) {
      setErr(error);
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
