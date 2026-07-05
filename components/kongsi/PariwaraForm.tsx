"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton } from "./KongsiButton";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

export function PariwaraForm({
  initialVideo,
  initialImage,
}: {
  initialVideo: string;
  initialImage: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "ok" } | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.from("settings").upsert([
      { key: "ad_video_url", value: String(form.get("video") ?? "").trim() },
      { key: "ad_image_url", value: String(form.get("image") ?? "").trim() },
    ]);
    if (error) return setStatus({ kind: "error", msg: error.message });
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
