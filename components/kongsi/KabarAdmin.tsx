"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KongsiButton } from "./KongsiButton";
import { Pill } from "./Pill";
import type { AdminArticle } from "@/lib/queries";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

const tags = [
  "Tips Belanja",
  "Cerita Saudagar",
  "Rempah",
  "Tukar Guling",
  "Pekan Raya",
];
const tones = ["indigo", "grenadine", "beeswax", "sage", "olive"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function KabarForm() {
  const router = useRouter();
  const [status, setStatus] = useState<
    { k: "idle" } | { k: "saving" } | { k: "ok" } | { k: "error"; m: string }
  >({ k: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ k: "saving" });
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) {
      setStatus({ k: "error", m: "Judul wajib." });
      return;
    }
    const body = String(f.get("body") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const publish = f.get("publish") === "on";
    const supabase = createClient();
    const { error } = await supabase.from("articles").insert({
      slug: slugify(title) || `artikel-${Date.now()}`,
      title,
      tag: String(f.get("tag") ?? tags[0]),
      excerpt: String(f.get("excerpt") ?? "").trim() || null,
      cover_tone: String(f.get("cover_tone") ?? "indigo"),
      body,
      published_at: publish ? new Date().toISOString() : null,
    });
    if (error) {
      setStatus({ k: "error", m: error.message });
      return;
    }
    (e.target as HTMLFormElement).reset();
    setStatus({ k: "ok" });
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm"
    >
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="k-title">
          Judul
        </label>
        <input id="k-title" name="title" className={fieldInput} placeholder="Judul artikel" />
      </div>
      <div className="mb-[14px] grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel} htmlFor="k-tag">
            Tag
          </label>
          <select id="k-tag" name="tag" className={fieldInput} defaultValue={tags[0]}>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor="k-tone">
            Warna cover
          </label>
          <select id="k-tone" name="cover_tone" className={fieldInput} defaultValue="indigo">
            {tones.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="k-excerpt">
          Ringkasan
        </label>
        <input id="k-excerpt" name="excerpt" className={fieldInput} placeholder="1 kalimat ringkas" />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor="k-body">
          Isi (1 paragraf per baris)
        </label>
        <textarea
          id="k-body"
          name="body"
          rows={4}
          className={fieldInput}
          placeholder={"Paragraf pertama…\nParagraf kedua…"}
        />
      </div>
      <label className="mb-[14px] flex items-center gap-2 text-[13px] font-bold">
        <input type="checkbox" name="publish" defaultChecked /> Terbitkan sekarang
      </label>
      {status.k === "error" ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {status.m}
        </p>
      ) : null}
      {status.k === "ok" ? (
        <p className="mb-3 text-[13px] font-bold text-kongsi-ok">✓ Artikel tersimpan</p>
      ) : null}
      <KongsiButton type="submit" variant="primary" disabled={status.k === "saving"}>
        {status.k === "saving" ? "Menyimpan…" : "Simpan Artikel"}
      </KongsiButton>
    </form>
  );
}

export function KabarAdmin({ items }: { items: AdminArticle[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function togglePublish(a: AdminArticle) {
    setBusy(a.slug);
    const supabase = createClient();
    await supabase
      .from("articles")
      .update({
        published_at: a.published_at ? null : new Date().toISOString(),
      })
      .eq("slug", a.slug);
    setBusy(null);
    router.refresh();
  }

  async function remove(slug: string) {
    setBusy(slug);
    const supabase = createClient();
    await supabase.from("articles").delete().eq("slug", slug);
    setBusy(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-kongsi-ink-soft">Belum ada artikel.</p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div
          key={a.slug}
          className="flex flex-wrap items-center gap-2 rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 text-[13px] shadow-hard-sm"
        >
          <span className="flex-1 font-bold">{a.title}</span>
          <Pill variant={a.published_at ? "sage" : "indigo"}>
            {a.published_at ? "terbit" : "draf"}
          </Pill>
          <button
            type="button"
            disabled={busy === a.slug}
            onClick={() => togglePublish(a)}
            className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-1 font-bold"
          >
            {a.published_at ? "Tarik" : "Terbitkan"}
          </button>
          <button
            type="button"
            disabled={busy === a.slug}
            onClick={() => remove(a.slug)}
            className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-1 font-bold text-kongsi-bad"
          >
            Hapus
          </button>
        </div>
      ))}
    </div>
  );
}
