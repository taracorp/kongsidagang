"use client";

import { useState } from "react";
import { bayarLelang } from "@/app/actions/lelang";
import { METODE_AWAL, rincianBayar } from "@/lib/payment/biaya";
import { formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";
import { PilihMetode } from "./PilihMetode";

const masukan = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] text-sm";

export function BayarLelangForm({ auctionId, cabang, neto }: { auctionId: string; cabang: { id: string; name: string; address: string }[]; neto: number }) {
  const [branch, setBranch] = useState(cabang[0]?.id ?? "");
  const [metode, setMetode] = useState(METODE_AWAL);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function bayar() {
    setBusy(true);
    setErr(null);
    const { error, data } = await bayarLelang(auctionId, branch, metode);
    if (error || !data) {
      setBusy(false);
      return setErr(error ?? "Gagal membuka pembayaran.");
    }
    window.location.assign(data.url);
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[13px] font-bold" htmlFor="cabang">
          Pilih cabang (voucher hanya berlaku di cabang ini)
        </label>
        <select id="cabang" value={branch} onChange={(e) => setBranch(e.target.value)} className={masukan}>
          {cabang.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.address}
            </option>
          ))}
        </select>
      </div>
      <PilihMetode ringkas neto={neto} value={metode} onChange={setMetode} />
      <KongsiButton type="button" block disabled={busy || !branch} onClick={bayar}>
        {busy ? "Membuka pembayaran…" : `Bayar ${formatKeping(rincianBayar(neto, metode).total)}`}
      </KongsiButton>
      {err ? <p className="text-[13px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
