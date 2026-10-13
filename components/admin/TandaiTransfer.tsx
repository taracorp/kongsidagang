"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tandaiTransferDibayar } from "@/app/actions/admin";
import { formatKeping } from "@/lib/utils";

/** Tandai transfer sudah dibayar: nomor referensi bank wajib + konfirmasi. */
export function TandaiTransfer({ id, nominal, siap }: { id: string; nominal: number; siap: boolean }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Sudah mentransfer ${formatKeping(nominal)} dengan referensi ${ref}? Tidak bisa dibatalkan.`)) return;
    setBusy(true);
    setErr(null);
    const { error } = await tandaiTransferDibayar(id, ref);
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }

  if (!siap) return <p className="text-[12px] text-kongsi-ink-soft">Menunggu penerima mengisi rekening (sudah dikabari).</p>;
  return (
    <form onSubmit={kirim} className="space-y-2">
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="No. referensi transfer"
        aria-label="Nomor referensi transfer"
        maxLength={80}
        className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[13px]"
      />
      <button
        type="submit"
        disabled={busy || ref.trim().length < 3}
        className="w-full cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-1 text-[13px] font-bold text-kongsi-parchment disabled:opacity-60"
      >
        {busy ? "Menyimpan…" : "Tandai sudah ditransfer"}
      </button>
      {err ? <p className="text-[12px] text-kongsi-bad">{err}</p> : null}
    </form>
  );
}
