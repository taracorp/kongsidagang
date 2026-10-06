"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { teraPenaksir } from "@/app/actions/tukar";
import type { TeraItem } from "@/lib/queries";
import { formatKeping } from "@/lib/utils";

function Kartu({ it }: { it: TeraItem }) {
  const router = useRouter();
  const [nilai, setNilai] = useState("");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function simpan() {
    setBusy(true);
    setErr(null);
    const { error } = await teraPenaksir(it.id, Number(nilai.replace(/\D/g, "")), catatan);
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <b className="font-fraunces text-[16px] text-kongsi-indigo">{it.title}</b>
        <span className="text-[12px] text-kongsi-ink-soft">
          {it.owner}
          {it.categoryName ? ` · ${it.categoryName}` : ""}
        </span>
      </div>
      <div className="mt-1 text-[13px]">
        Taksiran sistem <b>{formatKeping(it.est_value)}</b> ({it.accuracy ?? "lama"}) · dibeli {it.boughtCondition ?? "?"}
        {it.purchasePrice ? ` ${formatKeping(it.purchasePrice)}` : ""}
        {it.purchaseYear ? ` (${it.purchaseYear})` : ""}
        {it.isCollectible ? " · koleksi" : ""}
      </div>
      {it.note ? (
        <p className="mt-2 rounded-[4px] border-[1.5px] border-kongsi-ink/30 bg-kongsi-parchment-3 px-3 py-2 text-[13px]">
          “{it.note}”
        </p>
      ) : null}
      {it.pembanding.length ? (
        <ul className="mt-2 space-y-[2px] text-[12px]">
          {it.pembanding.map((p) => (
            <li key={p.url} className="flex justify-between gap-2">
              <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 flex-1 truncate underline">
                {p.sumber} · {p.kondisi} · {p.judul}
              </a>
              <b>{formatKeping(p.harga)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-kongsi-ink-soft">Tidak ada pembanding pasar.</p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
        <input
          inputMode="numeric"
          value={nilai ? Number(nilai.replace(/\D/g, "")).toLocaleString("id-ID") : ""}
          onChange={(e) => setNilai(e.target.value.replace(/\D/g, ""))}
          placeholder="nilai tera (Rp)"
          aria-label={`Nilai tera ${it.title}`}
          className="rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-sm"
        />
        <input
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          maxLength={500}
          placeholder="dasar penilaian (tampil ke pemilik)"
          aria-label={`Catatan tera ${it.title}`}
          className="rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={busy || !nilai}
          onClick={simpan}
          className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-beeswax px-3 py-1 text-xs font-bold disabled:opacity-60"
        >
          {busy ? "…" : "Tera"}
        </button>
      </div>
      {err ? <div className="mt-1 text-[11px] text-kongsi-bad">{err}</div> : null}
    </div>
  );
}

export function TeraPenaksir({ items }: { items: TeraItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
        Tidak ada permintaan tera.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Kartu key={it.id} it={it} />
      ))}
    </div>
  );
}
