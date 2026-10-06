"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buatArtikel, ubahArtikel, aturTerbitArtikel, hapusArtikel } from "@/app/actions/admin";
import { KongsiButton } from "./KongsiButton";
import { Pill } from "./Pill";
import type { AdminArticle } from "@/lib/queries";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";

const tags = ["Tips Belanja", "Cerita Saudagar", "Rempah", "Tukar Guling", "Pekan Raya"];
const tones = ["indigo", "grenadine", "beeswax", "sage", "olive"];
const MIN_PARAGRAF = 3;

/** Form buat (tanpa `awal`) atau ubah artikel (dengan `awal`). 1 paragraf per baris. */
export function KabarForm({ awal, onSelesai }: { awal?: AdminArticle; onSelesai?: () => void }) {
  const router = useRouter();
  const [isi, setIsi] = useState(awal?.body.join("\n") ?? "");
  const [status, setStatus] = useState<{ k: "idle" } | { k: "saving" } | { k: "ok" } | { k: "error"; m: string }>({ k: "idle" });
  const paragraf = isi.split("\n").map((s) => s.trim()).filter(Boolean);
  const id = awal?.slug ?? "baru";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (paragraf.length < MIN_PARAGRAF) {
      setStatus({ k: "error", m: `Isi minimal ${MIN_PARAGRAF} paragraf (sekarang ${paragraf.length}).` });
      return;
    }
    setStatus({ k: "saving" });
    const input = {
      title: String(f.get("title") ?? ""),
      tag: String(f.get("tag") ?? tags[0]),
      excerpt: String(f.get("excerpt") ?? ""),
      cover_tone: String(f.get("cover_tone") ?? "indigo"),
      body: paragraf,
      publish: f.get("publish") === "on",
    };
    const { error } = awal ? await ubahArtikel(awal.slug, input) : await buatArtikel(input);
    if (error) {
      setStatus({ k: "error", m: error });
      return;
    }
    if (!awal) {
      (e.target as HTMLFormElement).reset();
      setIsi("");
    }
    setStatus({ k: "ok" });
    onSelesai?.();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor={`k-title-${id}`}>
          Judul
        </label>
        <input id={`k-title-${id}`} name="title" defaultValue={awal?.title} className={fieldInput} placeholder="Judul artikel" />
      </div>
      <div className="mb-[14px] grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel} htmlFor={`k-tag-${id}`}>
            Tag
          </label>
          <select id={`k-tag-${id}`} name="tag" className={fieldInput} defaultValue={awal?.tag ?? tags[0]}>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel} htmlFor={`k-tone-${id}`}>
            Warna cover
          </label>
          <select id={`k-tone-${id}`} name="cover_tone" className={fieldInput} defaultValue={awal?.cover_tone ?? "indigo"}>
            {tones.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor={`k-excerpt-${id}`}>
          Ringkasan
        </label>
        <input id={`k-excerpt-${id}`} name="excerpt" defaultValue={awal?.excerpt ?? ""} className={fieldInput} placeholder="1 kalimat ringkas" />
      </div>
      <div className="mb-[14px]">
        <label className={fieldLabel} htmlFor={`k-body-${id}`}>
          Isi — 1 paragraf per baris (min. {MIN_PARAGRAF}) ·{" "}
          <span className={paragraf.length >= MIN_PARAGRAF ? "text-kongsi-ok" : "text-kongsi-bad"}>{paragraf.length} paragraf</span>
        </label>
        <textarea
          id={`k-body-${id}`}
          rows={10}
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          className={fieldInput}
          placeholder={"Paragraf pertama…\nParagraf kedua…\nParagraf ketiga…"}
        />
      </div>
      <label className="mb-[14px] flex items-center gap-2 text-[13px] font-bold">
        <input type="checkbox" name="publish" defaultChecked={awal ? !!awal.published_at : true} /> Terbitkan
      </label>
      {status.k === "error" ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">{status.m}</p>
      ) : null}
      {status.k === "ok" ? <p className="mb-3 text-[13px] font-bold text-kongsi-ok">✓ Artikel tersimpan</p> : null}
      <div className="flex gap-2">
        <KongsiButton type="submit" variant="primary" disabled={status.k === "saving"}>
          {status.k === "saving" ? "Menyimpan…" : awal ? "Simpan Perubahan" : "Simpan Artikel"}
        </KongsiButton>
        {awal && onSelesai ? (
          <KongsiButton type="button" variant="ghost" onClick={onSelesai}>
            Batal
          </KongsiButton>
        ) : null}
      </div>
    </form>
  );
}

export function KabarAdmin({ items }: { items: AdminArticle[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [ubah, setUbah] = useState<string | null>(null);

  async function togglePublish(a: AdminArticle) {
    setBusy(a.slug);
    await aturTerbitArtikel(a.slug, !a.published_at);
    setBusy(null);
    router.refresh();
  }

  async function remove(slug: string) {
    setBusy(slug);
    await hapusArtikel(slug);
    setBusy(null);
    router.refresh();
  }

  if (items.length === 0) return <p className="text-[13px] text-kongsi-ink-soft">Belum ada artikel.</p>;

  return (
    <div className="space-y-2">
      {items.map((a) =>
        ubah === a.slug ? (
          <KabarForm key={a.slug} awal={a} onSelesai={() => setUbah(null)} />
        ) : (
          <div key={a.slug} className="rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 text-[13px] shadow-hard-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 font-bold">{a.title}</span>
              <Pill variant={a.published_at ? "sage" : "indigo"}>{a.published_at ? "terbit" : "draf"}</Pill>
              <button type="button" onClick={() => setUbah(a.slug)} className="cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-2 py-1 font-bold">
                Ubah
              </button>
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
            <div className={a.body.length < MIN_PARAGRAF ? "mt-1 font-bold text-kongsi-bad" : "mt-1 text-kongsi-ink-soft"}>
              {a.tag} · {a.body.length} paragraf{a.body.length < MIN_PARAGRAF ? " — terlalu pendek" : ""} · {a.body[0]?.slice(0, 90) ?? "(kosong)"}
              {a.body[0] && a.body[0].length > 90 ? "…" : ""}
            </div>
          </div>
        ),
      )}
    </div>
  );
}
