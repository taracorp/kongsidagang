"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { selesaikanBermasalah } from "@/app/actions/admin";

/** Form kecil: catat tindakan lalu tandai selesai. */
export function SelesaikanBermasalah({ id }: { id: string }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Tandai sudah ditangani? Catatan ini tidak bisa diubah.")) return;
    setBusy(true);
    setErr(null);
    const { error } = await selesaikanBermasalah(id, catatan);
    setBusy(false);
    if (error) return setErr(error);
    router.refresh();
  }

  return (
    <form onSubmit={kirim} className="mt-2 flex flex-col gap-2 sm:flex-row">
      <input
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Tindakan (mis. refund via DOKU BO, ref …)"
        aria-label="Catatan tindakan"
        maxLength={500}
        className="w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[13px]"
      />
      <button
        type="submit"
        disabled={busy || catatan.trim().length < 5}
        className="cursor-pointer whitespace-nowrap rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-1 text-[13px] font-bold text-kongsi-parchment disabled:opacity-60"
      >
        Tandai selesai
      </button>
      {err ? <p className="text-[12px] text-kongsi-bad">{err}</p> : null}
    </form>
  );
}
