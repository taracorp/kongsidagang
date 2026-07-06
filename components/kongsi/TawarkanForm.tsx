"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton } from "./KongsiButton";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

const tones = [
  "sage",
  "beeswax",
  "beeswax-dark",
  "grenadine",
  "grenadine-dark",
  "olive",
  "indigo",
];

export function TawarkanForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<
    { k: "idle" } | { k: "saving" } | { k: "error"; m: string }
  >({ k: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ k: "saving" });
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    const est = Number(String(f.get("est_value") ?? "").replace(/\D/g, ""));
    if (!title || !est) {
      setStatus({ k: "error", m: "Isi nama barang & taksiran nilai." });
      return;
    }
    const supabase = createClient();

    let photo_url: string | null = null;
    const file = f.get("photo");
    if (file instanceof File && file.size > 0) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^\w.]+/g, "-")}`;
      const up = await supabase.storage.from("barter").upload(path, file, {
        upsert: false,
      });
      if (up.error) {
        setStatus({ k: "error", m: up.error.message });
        return;
      }
      photo_url = supabase.storage.from("barter").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("barter_items").insert({
      user_id: userId,
      title,
      est_value: est,
      want_text: String(f.get("want_text") ?? "").trim() || null,
      city: String(f.get("city") ?? "").trim() || null,
      tone: String(f.get("tone") ?? "sage"),
      photo_url,
      status: "aktif",
    });
    if (error) {
      setStatus({ k: "error", m: error.message });
      return;
    }
    router.push("/tukar");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard"
    >
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="title">
          Nama barang
        </label>
        <input id="title" name="title" className={fieldInput} placeholder="cth. Sepatu Lari" />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="est_value">
          Taksiran nilai (keping = Rp)
        </label>
        <input
          id="est_value"
          name="est_value"
          inputMode="numeric"
          className={fieldInput}
          placeholder="cth. 250000"
        />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="want_text">
          Mau ditukar dengan
        </label>
        <input
          id="want_text"
          name="want_text"
          className={fieldInput}
          placeholder="cth. tas ransel / jam tangan"
        />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="city">
          Kota
        </label>
        <input id="city" name="city" className={fieldInput} placeholder="cth. Sleman" />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="tone">
          Warna kartu
        </label>
        <select id="tone" name="tone" className={fieldInput} defaultValue="sage">
          {tones.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="photo">
          Foto barang (opsional)
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          className="w-full text-sm"
        />
      </div>
      {status.k === "error" ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {status.m}
        </p>
      ) : null}
      <KongsiButton type="submit" variant="primary" block disabled={status.k === "saving"}>
        {status.k === "saving" ? "Mengunggah…" : "Unggah Barang"}
      </KongsiButton>
    </form>
  );
}
