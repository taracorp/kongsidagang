"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { simpanPariwara } from "@/app/actions/admin";
import { KongsiButton } from "./KongsiButton";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

export function PariwaraForm({
  initialVideo,
  initialImage,
  initialTvc = [],
}: {
  initialVideo: string;
  initialImage: string;
  initialTvc?: string[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "ok" } | { kind: "error"; msg: string }
  >({ kind: "idle" });
  // Daftar URL TVC untuk panggung lelang (hingga 6; kolom kosong diabaikan saat simpan).
  const [tvc, setTvc] = useState<string[]>(() => {
    const base = initialTvc.slice(0, 6);
    while (base.length < 3) base.push("");
    return base;
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const form = new FormData(e.currentTarget);
    const { error } = await simpanPariwara(
      String(form.get("video") ?? ""),
      String(form.get("image") ?? ""),
      tvc.map((s) => s.trim()).filter(Boolean),
    );
    if (error) return setStatus({ kind: "error", msg: error });
    setStatus({ kind: "ok" });
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm"
    >
      <p className="mb-3 text-[13px] text-kongsi-ink-soft">
        Tampil di Beranda saat <b>tidak ada lelang aktif</b>. Video diprioritaskan
        di atas gambar. Kosongkan keduanya untuk placeholder.
      </p>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="video">
          URL Video (mp4/webm)
        </label>
        <input
          id="video"
          name="video"
          defaultValue={initialVideo}
          className={fieldInput}
          placeholder="https://…/promo.mp4"
        />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="image">
          URL Gambar
        </label>
        <input
          id="image"
          name="image"
          defaultValue={initialImage}
          className={fieldInput}
          placeholder="https://…/banner.jpg"
        />
      </div>
      <div className="mb-[14px] rounded-[4px] border-2 border-dashed border-kongsi-ink/40 p-3">
        <div className={fieldLabel}>TVC Panggung Lelang (mp4, vertikal 9:16, maks 6)</div>
        <p className="mb-2 text-[11px] text-kongsi-ink-soft">
          Berputar bergantian di halaman <b>/lelang</b>. Upload mp4 ke <code>/var/www/kongsidagang-uploads/tvc/</code> di VPS,
          lalu isi URL-nya (contoh <code>/uploads/tvc/tvc-01.mp4</code>). Kosongkan baris untuk menghapus.
        </p>
        <div className="space-y-2">
          {tvc.map((u, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={u}
                onChange={(e) => setTvc((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className={fieldInput}
                placeholder={`TVC ${i + 1} — /uploads/tvc/…mp4`}
              />
              <button
                type="button"
                onClick={() => setTvc((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-2 text-[12px] font-bold"
                aria-label={`Hapus TVC ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {tvc.length < 6 ? (
          <button
            type="button"
            onClick={() => setTvc((prev) => [...prev, ""])}
            className="mt-2 rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2 px-3 py-[6px] text-[12px] font-bold"
          >
            + Tambah TVC
          </button>
        ) : null}
      </div>
      {status.kind === "error" ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {status.msg}
        </p>
      ) : null}
      {status.kind === "ok" ? (
        <p className="mb-3 text-[13px] font-bold text-kongsi-ok">✓ Tersimpan</p>
      ) : null}
      <KongsiButton type="submit" variant="primary" disabled={status.kind === "saving"}>
        {status.kind === "saving" ? "Menyimpan…" : "Simpan Pariwara"}
      </KongsiButton>
    </form>
  );
}
