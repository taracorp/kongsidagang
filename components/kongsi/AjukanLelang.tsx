"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ajukanLelang } from "@/app/actions/lelang";
import { SlideEditor, emptyDraft, draftToSlides, type SlideDraft } from "./SlideEditor";
import { KongsiButton } from "./KongsiButton";
import { formatKeping } from "@/lib/utils";
import type { UsulanRow } from "@/lib/queries";

const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[8px] font-work text-[13px] focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[4px] block text-[12px] font-bold text-kongsi-indigo";

const statusWarna: Record<string, string> = {
  diajukan: "text-kongsi-indigo",
  diterima: "text-kongsi-ok",
  ditolak: "text-kongsi-bad",
};

export function AjukanLelang({
  produk,
  usulan,
}: {
  produk: { id: string; name: string; price: number }[];
  usulan: UsulanRow[];
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [productId, setProductId] = useState(produk[0]?.id ?? "");
  const [draft, setDraft] = useState<SlideDraft>(emptyDraft());
  const [usulDeal, setUsulDeal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const prod = produk.find((p) => p.id === productId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await ajukanLelang({
      productId,
      slides: draftToSlides(draft),
      usulDeal: Number(String(usulDeal).replace(/\D/g, "")),
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error });
    setMsg({ ok: true, text: "Usulan terkirim — menunggu tinjauan pengurus." });
    setDraft(emptyDraft());
    setUsulDeal("");
    setBuka(false);
    router.refresh();
  }

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-fraunces text-lg font-black text-kongsi-indigo">Ajukan Lelang</h4>
        <span className="text-[12px] text-kongsi-ink-soft">Barangmu tampil di Balai Lelang dengan Bang Kongsi.</span>
        {!buka ? (
          <button type="button" onClick={() => setBuka(true)} className="ml-auto rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-[6px] text-[13px] font-bold text-kongsi-parchment" disabled={produk.length === 0}>
            + Ajukan
          </button>
        ) : null}
      </div>

      {produk.length === 0 ? (
        <p className="mt-2 text-[12px] text-kongsi-ink-soft">Tambah dulu produk e-voucher di bagian E-voucher perawatan.</p>
      ) : null}

      {buka ? (
        <form onSubmit={submit} className="mt-3 space-y-4">
          <div>
            <label className={label} htmlFor="aj-prod">Produk yang dilelang</label>
            <select id="aj-prod" value={productId} onChange={(e) => setProductId(e.target.value)} className={fieldInput}>
              {produk.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — normal {formatKeping(p.price)}</option>
              ))}
            </select>
          </div>

          <SlideEditor value={draft} onChange={setDraft} />

          <div>
            <label className={label} htmlFor="aj-deal">Usulan hak lapak (yang kamu terima bila laku)</label>
            <input
              id="aj-deal"
              inputMode="numeric"
              value={usulDeal}
              onChange={(e) => setUsulDeal(e.target.value)}
              className={fieldInput}
              placeholder={prod ? `mis. ${Math.round(prod.price * 0.6).toLocaleString("id-ID")}` : "rupiah"}
            />
            <p className="mt-1 text-[11px] text-kongsi-ink-soft">
              Pengurus akan menetapkan harga yang ditebak pembeli (rahasia) di atas angka ini. Nama lapakmu tampil apa adanya.
            </p>
          </div>

          {msg ? <p className={`text-[12px] font-bold ${msg.ok ? "text-kongsi-ok" : "text-kongsi-bad"}`}>{msg.text}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setBuka(false)} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-[8px] text-[13px] font-bold">Batal</button>
            <KongsiButton type="submit" variant="primary" disabled={busy}>{busy ? "Mengirim…" : "Kirim usulan"}</KongsiButton>
          </div>
        </form>
      ) : null}

      {msg && !buka ? <p className={`mt-2 text-[12px] font-bold ${msg.ok ? "text-kongsi-ok" : "text-kongsi-bad"}`}>{msg.text}</p> : null}

      {usulan.length ? (
        <ul className="mt-3 space-y-1 border-t-[1.5px] border-kongsi-ink/20 pt-3 text-[12px]">
          {usulan.map((u) => (
            <li key={u.id} className="flex flex-wrap justify-between gap-2">
              <span>{u.product_name} · usul hak {formatKeping(u.usul_deal)}</span>
              <span className={`font-bold ${statusWarna[u.status] ?? ""}`}>
                {u.status}{u.status === "ditolak" && u.catatan ? ` — ${u.catatan}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
