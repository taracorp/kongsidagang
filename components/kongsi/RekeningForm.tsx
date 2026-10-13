"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { simpanRekening } from "@/app/actions/tukar";
import { BANK } from "@/lib/data/bank";
import { KongsiButton } from "./KongsiButton";

const input =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[5px] block text-[13px] font-bold";

export function RekeningForm({ awal }: { awal: { bank: string; nomor: string; atas_nama: string } | null }) {
  const router = useRouter();
  const [bank, setBank] = useState(awal?.bank ?? BANK[0].kode);
  const [nomor, setNomor] = useState(awal?.nomor ?? "");
  const [nama, setNama] = useState(awal?.atas_nama ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; teks: string } | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await simpanRekening({ bank, nomor, atas_nama: nama });
    setBusy(false);
    if (error) return setMsg({ ok: false, teks: error });
    setMsg({ ok: true, teks: "✓ Rekening tersimpan." });
    router.refresh();
  }

  return (
    <form onSubmit={kirim} className="space-y-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
      <div>
        <label className={label} htmlFor="bank">
          Bank
        </label>
        <select id="bank" value={bank} onChange={(e) => setBank(e.target.value)} className={input}>
          {BANK.map((b) => (
            <option key={b.kode} value={b.kode}>
              {b.nama}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="nomor">
          Nomor rekening
        </label>
        <input id="nomor" inputMode="numeric" maxLength={20} value={nomor} onChange={(e) => setNomor(e.target.value.replace(/\D/g, ""))} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="nama">
          Nama pemilik rekening
        </label>
        <input id="nama" maxLength={60} value={nama} onChange={(e) => setNama(e.target.value)} className={input} />
      </div>
      <KongsiButton type="submit" block disabled={busy || nomor.length < 5 || nama.trim().length < 3}>
        {busy ? "Menyimpan…" : "Simpan rekening"}
      </KongsiButton>
      {msg ? <p className={msg.ok ? "text-[13px] font-bold text-kongsi-ok" : "text-[13px] text-kongsi-bad"}>{msg.teks}</p> : null}
    </form>
  );
}
