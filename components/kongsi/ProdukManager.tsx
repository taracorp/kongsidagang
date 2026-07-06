"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, formatKeping } from "@/lib/utils";
import type { LapakProduct } from "@/lib/queries";

const tones = [
  "sage",
  "beeswax",
  "beeswax-dark",
  "grenadine",
  "grenadine-dark",
  "olive",
  "indigo",
];
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-sm outline-none";

export function ProdukManager({
  merchantId,
  products,
}: {
  merchantId: string;
  products: LapakProduct[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const num = (v: FormDataEntryValue | null) =>
    Number(String(v ?? "").replace(/\D/g, "")) || 0;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const price = num(f.get("price"));
    if (!name || !price) {
      setMsg("Isi nama & harga.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from("merchant_products").insert({
      merchant_id: merchantId,
      name,
      price,
      old_price: num(f.get("old_price")) || null,
      tone: String(f.get("tone") ?? "sage"),
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  async function saveEdit(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("merchant_products")
      .update({
        name: String(f.get("name") ?? "").trim(),
        price: num(f.get("price")),
        old_price: num(f.get("old_price")) || null,
      })
      .eq("id", id);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  async function toggle(p: LapakProduct) {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("merchant_products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("merchant_products").delete().eq("id", id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="mb-3 grid grid-cols-2 gap-2 rounded-[5px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-3 sm:grid-cols-5"
      >
        <input name="name" placeholder="Nama produk" className={cn(fieldInput, "col-span-2")} />
        <input name="price" inputMode="numeric" placeholder="Harga" className={fieldInput} />
        <input name="old_price" inputMode="numeric" placeholder="Harga coret" className={fieldInput} />
        <select name="tone" className={fieldInput} defaultValue="sage">
          {tones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-3 py-1 text-sm font-bold text-kongsi-parchment sm:col-span-5"
        >
          + Tambah Produk
        </button>
      </form>
      {msg ? <p className="mb-2 text-[12px] text-kongsi-bad">{msg}</p> : null}

      <div className="overflow-x-auto rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-kongsi-indigo text-left font-fraunces text-xs text-kongsi-parchment">
              <th className="p-[9px_12px]">Produk</th>
              <th className="p-[9px_12px]">Harga</th>
              <th className="p-[9px_12px]">Status</th>
              <th className="p-[9px_12px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-[13px] text-kongsi-ink-soft">
                  Belum ada produk.
                </td>
              </tr>
            ) : (
              products.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="bg-kongsi-sage/10">
                    <td colSpan={4} className="border-t-[1.5px] border-kongsi-ink/15 p-2">
                      <form onSubmit={(e) => saveEdit(p.id, e)} className="flex flex-wrap gap-2">
                        <input name="name" defaultValue={p.name} className={cn(fieldInput, "flex-1")} />
                        <input name="price" defaultValue={p.price} className={cn(fieldInput, "w-[110px]")} />
                        <input name="old_price" defaultValue={p.old_price ?? ""} placeholder="coret" className={cn(fieldInput, "w-[110px]")} />
                        <button type="submit" disabled={busy} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-ok px-3 py-1 text-xs font-bold text-kongsi-parchment">
                          Simpan
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-xs font-bold">
                          Batal
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="even:bg-kongsi-sage/10">
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-semibold">
                      {p.name}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      {formatKeping(p.price)}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      <span
                        className={cn(
                          "rounded-full border-[1.5px] border-kongsi-ink px-2 py-[1px] text-[11px] font-bold",
                          p.is_active ? "bg-kongsi-sage" : "bg-kongsi-parchment-2 text-kongsi-ink-soft",
                        )}
                      >
                        {p.is_active ? "aktif" : "nonaktif"}
                      </span>
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      <span className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditing(p.id)} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-[3px] text-xs font-bold">
                          Ubah
                        </button>
                        <button type="button" disabled={busy} onClick={() => toggle(p)} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-[3px] text-xs font-bold">
                          {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button type="button" disabled={busy} onClick={() => remove(p.id)} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-[3px] text-xs font-bold text-kongsi-bad">
                          Hapus
                        </button>
                      </span>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
