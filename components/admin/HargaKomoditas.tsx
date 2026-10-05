"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aturHargaKomoditas } from "@/app/actions/tukar";
import { formatKeping } from "@/lib/utils";

export type KomoditasRow = { slug: string; name: string; unit: string | null; price: number | null };

function Baris({ row }: { row: KomoditasRow }) {
  const router = useRouter();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function simpan() {
    setBusy(true);
    setErr(null);
    const { error } = await aturHargaKomoditas(row.slug, Number(val.replace(/\D/g, "")));
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setVal("");
    router.refresh();
  }

  const td = "border-t-[1.5px] border-kongsi-ink/15 p-[11px_14px]";
  return (
    <tr className="even:bg-kongsi-sage/10">
      <td className={`${td} font-semibold`}>{row.name}</td>
      <td className={td}>{row.price ? `${formatKeping(row.price)} / ${row.unit}` : "—"}</td>
      <td className={td}>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
            placeholder="harga baru"
            aria-label={`Harga baru ${row.name}`}
            className="w-28 rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={busy || !val}
            onClick={simpan}
            className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-3 py-1 text-xs font-bold disabled:opacity-60"
          >
            {busy ? "…" : "Simpan"}
          </button>
        </div>
        {err ? <div className="mt-1 text-[11px] text-kongsi-bad">{err}</div> : null}
      </td>
    </tr>
  );
}

export function HargaKomoditas({ rows }: { rows: KomoditasRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
            <th className="p-[11px_14px]">Komoditas</th>
            <th className="p-[11px_14px]">Harga berlaku</th>
            <th className="p-[11px_14px]">Perbarui</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Baris key={r.slug} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
