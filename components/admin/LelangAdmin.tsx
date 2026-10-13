"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { batalkanLelang, buatLelang, mulaiLelang } from "@/app/actions/lelang";
import { cn, formatKeping } from "@/lib/utils";

const masukan = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-[13px]";
const label = "mb-1 block text-[12px] font-bold";
const tombol = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-[12px] font-bold disabled:opacity-60";

export function FormLelangBaru({ produk }: { produk: { id: string; label: string; harga: number }[] }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pid, setPid] = useState(produk[0]?.id ?? "");
  const harga = produk.find((p) => p.id === pid)?.harga ?? 0;

  async function kirim(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await buatLelang(new FormData(e.currentTarget));
    setBusy(false);
    if (error) return setErr(error);
    setBuka(false);
    router.refresh();
  }

  if (!buka) {
    return (
      <button type="button" onClick={() => setBuka(true)} className={cn(tombol, "bg-kongsi-grenadine text-kongsi-parchment")}>
        + Lelang baru
      </button>
    );
  }
  return (
    <form onSubmit={kirim} className="grid gap-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={label} htmlFor="product_id">
          Produk e-voucher lapak
        </label>
        <select id="product_id" name="product_id" value={pid} onChange={(e) => setPid(e.target.value)} className={masukan}>
          {produk.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({formatKeping(p.harga)})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="clue_category">
          Clue kategori (tampil publik)
        </label>
        <input id="clue_category" name="clue_category" required className={masukan} placeholder="cth. Facial premium" />
      </div>
      <div>
        <label className={label} htmlFor="clue_name_masked">
          Nama lapak disamarkan
        </label>
        <input id="clue_name_masked" name="clue_name_masked" required className={masukan} placeholder="cth. B••••y C••••r" />
      </div>
      <div>
        <label className={label} htmlFor="normal_price">
          Harga normal
        </label>
        <input id="normal_price" name="normal_price" inputMode="numeric" defaultValue={harga} key={pid} className={masukan} />
      </div>
      <div>
        <label className={label} htmlFor="deal_price">
          Harga deal (hak lapak, rahasia)
        </label>
        <input id="deal_price" name="deal_price" inputMode="numeric" required className={masukan} />
      </div>
      <div>
        <label className={label} htmlFor="set_price">
          Harga set (dibayar pemenang, rahasia)
        </label>
        <input id="set_price" name="set_price" inputMode="numeric" required className={masukan} />
      </div>
      <div>
        <label className={label} htmlFor="capacity">
          Kapasitas peserta
        </label>
        <input id="capacity" name="capacity" inputMode="numeric" defaultValue={10} className={masukan} />
      </div>
      <div>
        <label className={label} htmlFor="type">
          Jenis
        </label>
        <select id="type" name="type" className={masukan}>
          <option value="reguler">Reguler</option>
          <option value="vendu">Vendu (khusus login)</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="facilities">
          Yang didapat (satu per baris)
        </label>
        <textarea id="facilities" name="facilities" rows={3} className={masukan} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={() => setBuka(false)} className={cn(tombol, "bg-kongsi-parchment")}>
          Batal
        </button>
        <button type="submit" disabled={busy} className={cn(tombol, "flex-1 bg-kongsi-grenadine text-kongsi-parchment")}>
          {busy ? "Menyimpan…" : "Simpan sebagai draf"}
        </button>
      </div>
      {err ? <p className="text-[12px] text-kongsi-bad sm:col-span-2">{err}</p> : null}
    </form>
  );
}

export function AksiLelang({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function jalankan(f: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setErr(null);
    const { error } = await f();
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }
  const bolehBatal = ["draf", "kumpul", "tebak", "jeda", "final"].includes(status);
  return (
    <div className="flex flex-col gap-1">
      {status === "draf" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => confirm("Mulai lelang sekarang? Tayang di Balai Lelang.") && jalankan(() => mulaiLelang(id))}
          className={cn(tombol, "bg-kongsi-sage")}
        >
          Mulai
        </button>
      ) : null}
      {bolehBatal ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const alasan = prompt("Alasan membatalkan lelang (minimal 10 huruf):");
            if (alasan) jalankan(() => batalkanLelang(id, alasan));
          }}
          className={cn(tombol, "bg-kongsi-parchment-3 text-kongsi-bad")}
        >
          Batalkan
        </button>
      ) : null}
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
    </div>
  );
}
