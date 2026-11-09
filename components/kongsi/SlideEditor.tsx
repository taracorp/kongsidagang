"use client";

import { useState } from "react";
import type { SlideData, SlideClue } from "@/lib/domain/slide";

const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[8px] font-work text-[13px] focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[4px] block text-[12px] font-bold text-kongsi-indigo";

async function unggah(file: File, jenis: "gambar" | "video"): Promise<string> {
  const fd = new FormData();
  fd.set("jenis", jenis);
  fd.set("file", file);
  const res = await fetch("/api/lelang/unggah", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Gagal mengunggah.");
  return data.url as string;
}

export type SlideDraft = {
  brandTagline: string;
  fungsi: string;
  pemicu: string;
  clues: SlideClue[];
  videos: string[];
  fasilitas: string[];
};

export function emptyDraft(): SlideDraft {
  return { brandTagline: "", fungsi: "", pemicu: "", clues: [{ teks: "" }], videos: [], fasilitas: [] };
}

export function fromSlideData(s: SlideData | null): SlideDraft {
  if (!s) return emptyDraft();
  return {
    brandTagline: s.brandTagline ?? "",
    fungsi: s.fungsi ?? "",
    pemicu: s.pemicu ?? "",
    clues: s.clues.length ? s.clues.map((c) => ({ teks: c.teks, gambar: c.gambar })) : [{ teks: "" }],
    videos: [...s.videos],
    fasilitas: [...s.fasilitas],
  };
}

export function SlideEditor({
  value,
  onChange,
}: {
  value: SlideDraft;
  onChange: (v: SlideDraft) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<SlideDraft>) => onChange({ ...value, ...patch });

  async function tambahGambar(i: number, file: File) {
    setBusy(`g${i}`); setErr(null);
    try {
      const url = await unggah(file, "gambar");
      set({ clues: value.clues.map((c, k) => (k === i ? { ...c, gambar: url } : c)) });
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal."); }
    setBusy(null);
  }
  async function tambahVideo(file: File) {
    setBusy("video"); setErr(null);
    try {
      const url = await unggah(file, "video");
      set({ videos: [...value.videos, url].slice(0, 3) });
    } catch (e) { setErr(e instanceof Error ? e.message : "Gagal."); }
    setBusy(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[4px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 p-2 text-[11px] text-kongsi-ink-soft">
        Ceritakan dulu, jangan langsung jualan: kenalkan brand → produk → <b>masalah yang diatasi</b> → pemicu → harga asli.
      </div>
      <div>
        <div className={label}>Tagline brand (opsional) — 1 kalimat</div>
        <input value={value.brandTagline} maxLength={160} onChange={(e) => set({ brandTagline: e.target.value })} className={fieldInput} placeholder="mis. Klinik kecantikan tepercaya sejak 2015" />
      </div>
      <div>
        <div className={label}>Fungsi / masalah yang diatasi *</div>
        <textarea value={value.fungsi} maxLength={160} rows={2} onChange={(e) => set({ fungsi: e.target.value })} className={fieldInput} placeholder="mis. Buat kamu yang wajahnya kusam, lelah, dan kurang cerah…" />
      </div>
      <div>
        <div className={label}>Pemicu / kenapa harus sekarang (opsional)</div>
        <textarea value={value.pemicu} maxLength={160} rows={2} onChange={(e) => set({ pemicu: e.target.value })} className={fieldInput} placeholder="mis. Makin ditunda, kulit makin susah diperbaiki. Mulai rawat dari sekarang." />
      </div>
      <div>
        <div className={label}>Keunggulan tambahan (opsional) — maks 3</div>
        <div className="space-y-2">
          {value.clues.map((c, i) => (
            <div key={i} className="rounded-[4px] border-2 border-kongsi-ink/40 p-2">
              <textarea
                value={c.teks}
                maxLength={120}
                onChange={(e) => set({ clues: value.clues.map((x, k) => (k === i ? { ...x, teks: e.target.value } : x)) })}
                rows={2}
                className={fieldInput}
                placeholder={`Clue ${i + 1} — mis. "Perawatan wajah premium 90 menit"`}
              />
              <div className="mt-1 flex items-center gap-2">
                <label className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-2 py-[3px] text-[11px] font-bold">
                  {busy === `g${i}` ? "Mengunggah…" : c.gambar ? "Ganti foto" : "+ Foto"}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && tambahGambar(i, e.target.files[0])} />
                </label>
                {c.gambar ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.gambar} alt="" className="h-8 w-8 rounded border border-kongsi-ink object-cover" />
                    <button type="button" className="text-[11px] font-bold text-kongsi-bad" onClick={() => set({ clues: value.clues.map((x, k) => (k === i ? { teks: x.teks } : x)) })}>hapus foto</button>
                  </>
                ) : null}
                {value.clues.length > 1 ? (
                  <button type="button" className="ml-auto text-[11px] font-bold text-kongsi-bad" onClick={() => set({ clues: value.clues.filter((_, k) => k !== i) })}>× hapus clue</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {value.clues.length < 3 ? (
          <button type="button" className="mt-2 rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-[5px] text-[12px] font-bold" onClick={() => set({ clues: [...value.clues, { teks: "" }] })}>+ Tambah clue</button>
        ) : null}
      </div>

      <div>
        <div className={label}>Video (TVC, vertikal 9:16) — maks 3</div>
        <div className="flex flex-wrap gap-2">
          {value.videos.map((v, i) => (
            <div key={v} className="relative">
              <video src={v} muted className="h-24 w-[54px] rounded border-2 border-kongsi-ink object-cover" />
              <button type="button" aria-label="hapus video" className="absolute -right-2 -top-2 rounded-full border-2 border-kongsi-ink bg-kongsi-parchment px-[6px] text-[11px] font-black" onClick={() => set({ videos: value.videos.filter((_, k) => k !== i) })}>×</button>
            </div>
          ))}
          {value.videos.length < 3 ? (
            <label className="flex h-24 w-[54px] cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-kongsi-ink text-center text-[10px] font-bold">
              {busy === "video" ? "…" : "+ Video"}
              <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => e.target.files?.[0] && tambahVideo(e.target.files[0])} />
            </label>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-kongsi-ink-soft">Otomatis dikecilkan ke 720p saat diunggah. Maks 100 MB/berkas.</p>
      </div>

      <div>
        <div className={label}>Yang didapat pemenang (satu per baris) — maks 8</div>
        <textarea
          value={value.fasilitas.join("\n")}
          onChange={(e) => set({ fasilitas: e.target.value.split("\n").slice(0, 8) })}
          rows={3}
          className={fieldInput}
          placeholder={"Facial signature premium\nKonsultasi dokter kulit"}
        />
      </div>

      {err ? <p className="text-[12px] font-bold text-kongsi-bad">{err}</p> : null}
    </div>
  );
}

/** Rapikan draft untuk dikirim ke server (buang baris kosong). */
export function draftToSlides(d: SlideDraft) {
  return {
    brandTagline: d.brandTagline.trim(),
    fungsi: d.fungsi.trim(),
    pemicu: d.pemicu.trim(),
    clues: d.clues.map((c) => ({ teks: c.teks.trim(), ...(c.gambar ? { gambar: c.gambar } : {}) })).filter((c) => c.teks || c.gambar),
    videos: d.videos,
    fasilitas: d.fasilitas.map((f) => f.trim()).filter(Boolean),
  };
}
