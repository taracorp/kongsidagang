"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DiskonInput } from "@/lib/domain/diskon";
import { cn, formatKeping } from "@/lib/utils";

const input = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-[7px] text-[13px]";
const label = "mb-1 block text-[12px] font-bold";
const tombol = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-1 text-[13px] font-bold disabled:opacity-60";

export type RingkasDiskon = {
  id: string; nama: string; jenis: string; nilai: number; maksPotongan: number | null; kode: string | null; pembuat: string;
  minBelanja: number; mulai: string | null; selesai: string | null; kuotaTotal: number | null; terpakai: number;
  terpakaiRupiah: number; anggaran: number | null; aktif: boolean; hanyaPembeliBaru: boolean; perluKlaim: boolean;
};

/**
 * Form + daftar promo. `pembuat`: "lapak" (ditanggung lapak) atau "platform" (ditanggung Kongsi, wajib anggaran).
 * `simpan`/`aturAktif` = server action yang sudah mengecek hak akses.
 */
export function PromoManager({
  pembuat,
  daftar,
  simpan,
  aturAktif,
}: {
  pembuat: "lapak" | "platform";
  daftar: RingkasDiskon[];
  simpan: (input: DiskonInput) => Promise<{ error: string | null }>;
  aturAktif: (id: string, aktif: boolean) => Promise<{ error: string | null }>;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<DiskonInput>({ nama: "", jenis: "persen", nilai: 10, perlu_klaim: false, kuota_per_user: 0, hanya_pembeli_baru: false });
  const set = (p: Partial<DiskonInput>) => setF((x) => ({ ...x, ...p }));

  async function kirim() {
    setBusy(true);
    setErr(null);
    const { error } = await simpan(f);
    setBusy(false);
    if (error) return setErr(error);
    setBuka(false);
    setF({ nama: "", jenis: "persen", nilai: 10, perlu_klaim: false, kuota_per_user: 1, hanya_pembeli_baru: false });
    router.refresh();
  }

  async function toggle(id: string, aktif: boolean) {
    await aturAktif(id, aktif);
    router.refresh();
  }

  const tanggung = pembuat === "lapak" ? "ditanggung lapak (mengurangi titipan)" : "ditanggung Kongsi (dari platform fee, wajib anggaran)";

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-kongsi-ink-soft">Diskon {tanggung}. Maks 1 diskon lapak + 1 diskon Kongsi per pesanan; dipilih yang paling hemat.</p>
      {daftar.length ? (
        <div className="space-y-2">
          {daftar.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-2 border-kongsi-ink/30 bg-kongsi-parchment-3 p-2 text-[12px]">
              <div>
                <b>{d.nama}</b> · {d.jenis === "persen" ? `${d.nilai}%${d.maksPotongan ? ` maks ${formatKeping(d.maksPotongan)}` : ""}` : formatKeping(d.nilai)}
                {d.kode ? <span className="ml-1 font-mono text-kongsi-grenadine">{d.kode}</span> : null}
                {d.hanyaPembeliBaru ? " · member baru" : ""}
                <div className="text-kongsi-ink-soft">
                  {d.minBelanja ? `min ${formatKeping(d.minBelanja)} · ` : ""}
                  terpakai {d.terpakai}×{d.kuotaTotal ? `/${d.kuotaTotal}` : ""}
                  {d.anggaran ? ` · anggaran ${formatKeping(d.terpakaiRupiah)}/${formatKeping(d.anggaran)}` : ""}
                  {d.selesai ? ` · s/d ${new Date(d.selesai).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" })}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => toggle(d.id, !d.aktif)} className={cn(tombol, d.aktif ? "bg-kongsi-sage" : "bg-kongsi-parchment text-kongsi-ink-soft")}>
                {d.aktif ? "Aktif" : "Nonaktif"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-kongsi-ink-soft">Belum ada promo.</p>
      )}

      {!buka ? (
        <button type="button" onClick={() => setBuka(true)} className={cn(tombol, "bg-kongsi-grenadine text-kongsi-parchment")}>
          + Promo baru
        </button>
      ) : (
        <div className="grid gap-2 rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Nama promo</label>
            <input value={f.nama} onChange={(e) => set({ nama: e.target.value })} className={input} placeholder="cth. Diskon member baru" />
          </div>
          <div>
            <label className={label}>Jenis</label>
            <select value={f.jenis} onChange={(e) => set({ jenis: e.target.value as "persen" | "potongan" })} className={input}>
              <option value="persen">Persen (%)</option>
              <option value="potongan">Potongan (Rp)</option>
            </select>
          </div>
          <div>
            <label className={label}>{f.jenis === "persen" ? "Nilai (%)" : "Potongan (Rp)"}</label>
            <input inputMode="numeric" value={f.nilai || ""} onChange={(e) => set({ nilai: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={input} />
          </div>
          {f.jenis === "persen" ? (
            <div>
              <label className={label}>Maks potongan (Rp, opsional)</label>
              <input inputMode="numeric" value={f.maks_potongan || ""} onChange={(e) => set({ maks_potongan: Number(e.target.value.replace(/\D/g, "")) || null })} className={input} />
            </div>
          ) : null}
          <div>
            <label className={label}>Min belanja (Rp)</label>
            <input inputMode="numeric" value={f.min_belanja || ""} onChange={(e) => set({ min_belanja: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={input} />
          </div>
          <div>
            <label className={label}>Kode voucher (opsional)</label>
            <input value={f.kode ?? ""} onChange={(e) => set({ kode: e.target.value.toUpperCase() })} className={input} placeholder="otomatis bila kosong" />
          </div>
          <div>
            <label className={label}>Kuota total (opsional)</label>
            <input inputMode="numeric" value={f.kuota_total || ""} onChange={(e) => set({ kuota_total: Number(e.target.value.replace(/\D/g, "")) || null })} className={input} />
          </div>
          <div>
            <label className={label}>Kuota per orang (kosong = tak terbatas)</label>
            <input inputMode="numeric" value={f.kuota_per_user || ""} onChange={(e) => set({ kuota_per_user: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={input} placeholder="tak terbatas" />
          </div>
          {pembuat === "platform" ? (
            <div>
              <label className={label}>Anggaran Kongsi (Rp) — wajib</label>
              <input inputMode="numeric" value={f.anggaran || ""} onChange={(e) => set({ anggaran: Number(e.target.value.replace(/\D/g, "")) || null })} className={input} />
            </div>
          ) : null}
          <div>
            <label className={label}>Mulai (opsional)</label>
            <input type="datetime-local" value={f.mulai_at ?? ""} onChange={(e) => set({ mulai_at: e.target.value || null })} className={input} />
          </div>
          <div>
            <label className={label}>Selesai (opsional)</label>
            <input type="datetime-local" value={f.selesai_at ?? ""} onChange={(e) => set({ selesai_at: e.target.value || null })} className={input} />
          </div>
          <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
            <input type="checkbox" checked={Boolean(f.hanya_pembeli_baru)} onChange={(e) => set({ hanya_pembeli_baru: e.target.checked })} />
            Hanya untuk pembeli baru (belum pernah belanja lunas)
          </label>
          <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
            <input type="checkbox" checked={Boolean(f.perlu_klaim)} onChange={(e) => set({ perlu_klaim: e.target.checked })} />
            Harus diklaim dulu (tidak otomatis)
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => setBuka(false)} className={cn(tombol, "bg-kongsi-parchment")}>
              Batal
            </button>
            <button type="button" disabled={busy || f.nama.trim().length < 3} onClick={kirim} className={cn(tombol, "flex-1 bg-kongsi-grenadine text-kongsi-parchment")}>
              {busy ? "Menyimpan…" : "Simpan promo"}
            </button>
          </div>
          {err ? <p className="text-[12px] text-kongsi-bad sm:col-span-2">{err}</p> : null}
        </div>
      )}
    </div>
  );
}
