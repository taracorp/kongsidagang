"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buatLelang, tolakUsulan } from "@/app/actions/lelang";
import { SlideEditor, fromSlideData, draftToSlides, type SlideDraft } from "@/components/kongsi/SlideEditor";
import { formatKeping } from "@/lib/utils";
import type { UsulanRow } from "@/lib/queries";

const input = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-[6px] text-[13px]";
const label = "mb-[3px] block text-[11px] font-bold text-kongsi-indigo";

function KartuUsulan({ u }: { u: UsulanRow }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SlideDraft>(fromSlideData(u.slides));
  const [deal, setDeal] = useState(String(u.usul_deal));
  const [setP, setSetP] = useState("");
  const [cap, setCap] = useState("20");
  const [dk, setDk] = useState("60");
  const [dt, setDt] = useState("120");
  const [type, setType] = useState("reguler");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function terima() {
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("product_id", u.product_id);
    fd.set("type", type);
    fd.set("clue_category", u.product_name);
    fd.set("normal_price", String(u.normal_price));
    fd.set("deal_price", String(Number(deal.replace(/\D/g, ""))));
    fd.set("set_price", String(Number(setP.replace(/\D/g, ""))));
    fd.set("capacity", cap);
    fd.set("durasi_kumpul", dk);
    fd.set("durasi_tebak", dt);
    fd.set("facilities", draftToSlides(draft).fasilitas.join("\n"));
    fd.set("slides", JSON.stringify(draftToSlides(draft)));
    fd.set("usulan_id", u.id);
    const { error } = await buatLelang(fd);
    setBusy(false);
    if (error) return setErr(error);
    router.refresh();
  }

  async function tolak() {
    const catatan = prompt("Alasan menolak usulan (tampil ke lapak):");
    if (!catatan) return;
    setBusy(true); setErr(null);
    const { error } = await tolakUsulan(u.id, catatan);
    setBusy(false);
    if (error) return setErr(error);
    router.refresh();
  }

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <b className="font-fraunces text-kongsi-indigo">{u.product_name}</b>
        <span className="text-[12px] text-kongsi-ink-soft">{u.merchant_name} · normal {formatKeping(u.normal_price)}</span>
      </div>

      <SlideEditor value={draft} onChange={setDraft} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div>
          <label className={label}>Hak lapak / deal (rahasia)</label>
          <input value={deal} onChange={(e) => setDeal(e.target.value)} inputMode="numeric" className={input} />
        </div>
        <div>
          <label className={label}>Harga set (ditebak, rahasia)</label>
          <input value={setP} onChange={(e) => setSetP(e.target.value)} inputMode="numeric" className={input} placeholder="wajib" />
        </div>
        <div>
          <label className={label}>Kapasitas</label>
          <input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="numeric" className={input} />
        </div>
        <div>
          <label className={label}>Durasi kumpul (mnt)</label>
          <input value={dk} onChange={(e) => setDk(e.target.value)} inputMode="numeric" className={input} />
        </div>
        <div>
          <label className={label}>Durasi tebak (mnt)</label>
          <input value={dt} onChange={(e) => setDt(e.target.value)} inputMode="numeric" className={input} />
        </div>
        <div>
          <label className={label}>Jenis</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
            <option value="reguler">Reguler</option>
            <option value="vendu">Lelang Khusus</option>
          </select>
        </div>
      </div>

      {err ? <p className="mt-2 text-[12px] font-bold text-kongsi-bad">{err}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={terima} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-[7px] text-[13px] font-bold text-kongsi-parchment">
          {busy ? "Memproses…" : "Terima → buat draf (+ suara)"}
        </button>
        <button type="button" disabled={busy} onClick={tolak} className="rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-[7px] text-[13px] font-bold text-kongsi-bad">
          Tolak
        </button>
      </div>
    </div>
  );
}

export function UsulanAdmin({ usulan }: { usulan: UsulanRow[] }) {
  if (!usulan.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">Usulan lelang dari lapak ({usulan.length})</h3>
      <p className="text-[12px] text-kongsi-ink-soft">
        Tinjau materi, isi harga set (rahasia, ≥ hak lapak + biaya transfer), lalu Terima. Suara Bang Kongsi dibuat otomatis.
        Begitu dibuat, lelang jadi draf di tabel bawah — tekan <b>Mulai</b> untuk tayang.
      </p>
      {usulan.map((u) => (
        <KartuUsulan key={u.id} u={u} />
      ))}
    </div>
  );
}
