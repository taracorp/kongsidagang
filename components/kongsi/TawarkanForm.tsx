"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tawarkanBarang } from "@/app/actions/tukar";
import { taksir, type Taksiran, type TaksiranCategory } from "@/lib/domain/taksiran";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
const chip =
  "cursor-pointer rounded-full border-[1.5px] border-kongsi-ink px-3 py-[6px] text-[13px] font-bold transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";
const chipOn = "bg-kongsi-grenadine text-kongsi-parchment";
const chipOff = "bg-kongsi-parchment-3 text-kongsi-ink";

const tones = ["sage", "beeswax", "beeswax-dark", "grenadine", "grenadine-dark", "olive", "indigo"];
const LANGKAH = ["Kategori", "Data barang", "Kondisi", "Foto & tukar"];

export function TawarkanForm({
  categories,
  nowYear,
}: {
  categories: TaksiranCategory[];
  nowYear: number;
}) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [year, setYear] = useState("");
  const [serial, setSerial] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [want, setWant] = useState("");
  const [city, setCity] = useState("");
  const [tone, setTone] = useState("sage");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.slug === slug) ?? null;
  const digits = (s: string) => Number(s.replace(/\D/g, ""));

  // Pratinjau saja — server menghitung ulang saat disimpan.
  const preview = useMemo<{ t: Taksiran | null; why: string | null }>(() => {
    if (!cat) return { t: null, why: null };
    try {
      const t = taksir(cat, {
        qty: Number(qty.replace(",", ".")),
        purchasePrice: digits(price),
        purchaseYear: digits(year),
        answers,
        nowYear,
      });
      return { t, why: null };
    } catch (e) {
      return { t: null, why: e instanceof Error ? e.message : null };
    }
  }, [cat, qty, price, year, answers, nowYear]);

  const allAnswered = !!cat && cat.checklist.every((c) => c.key in answers);

  function validate(s: number): string | null {
    if (s === 0 && !cat) return "Pilih kategori dulu.";
    if (s === 1) {
      if (!title.trim()) return "Isi nama barang.";
      if (preview.why) return preview.why;
      if (cat?.needs_serial && !serial.trim()) return `Isi ${cat.serial_label ?? "nomor seri"}.`;
    }
    if (s === 2 && !allAnswered) return "Jawab semua pertanyaan kondisi — ini jadi patokan bila ada sengketa.";
    return null;
  }

  function next() {
    const v = validate(step);
    setErr(v);
    if (!v) setStep((s) => Math.min(LANGKAH.length - 1, s + 1));
  }

  async function submit() {
    for (let s = 0; s < 3; s++) {
      const v = validate(s);
      if (v) {
        setStep(s);
        setErr(v);
        return;
      }
    }
    setSaving(true);
    setErr(null);
    const f = new FormData();
    f.set("title", title.trim());
    f.set("category", cat!.slug);
    f.set("qty", qty);
    f.set("purchase_price", price);
    f.set("purchase_year", year);
    f.set("serial_number", serial);
    f.set("answers", JSON.stringify(answers));
    f.set("want_text", want);
    f.set("city", city);
    f.set("tone", tone);
    const photo = photoRef.current?.files?.[0];
    if (photo) f.set("photo", photo);
    const { error } = await tawarkanBarang(f);
    setSaving(false);
    if (error) {
      setErr(error);
      return;
    }
    router.push("/tukar");
  }

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
      {/* Penanda langkah */}
      <ol className="mb-4 flex flex-wrap gap-[6px]">
        {LANGKAH.map((l, i) => (
          <li key={l}>
            <button
              type="button"
              onClick={() => {
                if (i < step) {
                  setErr(null);
                  setStep(i);
                }
              }}
              className={cn(
                "rounded-full border-[1.5px] border-kongsi-ink px-[9px] py-1 text-[11px] font-bold",
                i === step && "bg-kongsi-indigo text-kongsi-parchment",
                i < step && "cursor-pointer bg-kongsi-sage text-kongsi-ink",
                i > step && "bg-kongsi-parchment-3 text-kongsi-ink-soft",
              )}
            >
              {i + 1}. {l}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div>
          <div className={fieldLabel}>Barang apa yang mau kamu tukar?</div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={slug === c.slug}
                onClick={() => {
                  setErr(null);
                  setSlug(c.slug);
                  setAnswers({});
                }}
                className={cn(chip, slug === c.slug ? chipOn : chipOff)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {cat?.kind === "komoditas" ? (
            <p className="mt-3 text-[12px] text-kongsi-ink-soft">
              Komoditas ditaksir dari harga pasar terkini
              {cat.price_per_unit ? ` (${formatKeping(cat.price_per_unit)}/${cat.unit})` : ""}.
            </p>
          ) : cat ? (
            <p className="mt-3 text-[12px] text-kongsi-ink-soft">
              Ditaksir dari harga beli, umur, dan kondisi barang.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 1 && cat ? (
        <div>
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="title">
              Nama barang
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldInput}
              placeholder={cat.kind === "komoditas" ? `cth. ${cat.name} 1 karung` : "cth. Sepeda Polygon Cascade"}
            />
          </div>
          {cat.kind === "komoditas" ? (
            <div className="mb-[14px]">
              <label className={fieldLabel} htmlFor="qty">
                Jumlah ({cat.unit})
              </label>
              <input
                id="qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={fieldInput}
                placeholder="cth. 100"
              />
            </div>
          ) : (
            <div className="mb-[14px] grid grid-cols-2 gap-3">
              <div>
                <label className={fieldLabel} htmlFor="price">
                  Harga beli (Rp)
                </label>
                <input
                  id="price"
                  inputMode="numeric"
                  value={price ? digits(price).toLocaleString("id-ID") : ""}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                  className={fieldInput}
                  placeholder="cth. 3.500.000"
                />
              </div>
              <div>
                <label className={fieldLabel} htmlFor="year">
                  Tahun beli
                </label>
                <input
                  id="year"
                  inputMode="numeric"
                  maxLength={4}
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
                  className={fieldInput}
                  placeholder={`cth. ${nowYear - 3}`}
                />
              </div>
            </div>
          )}
          {cat.needs_serial ? (
            <div className="mb-[14px]">
              <label className={fieldLabel} htmlFor="serial">
                {cat.serial_label ?? "Nomor seri"}
              </label>
              <input
                id="serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className={fieldInput}
                placeholder="wajib — mencegah barang curian"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 && cat ? (
        <div>
          <div className={fieldLabel}>Jujur soal kondisi — jawaban ini jadi patokan Syahbandar bila ada sengketa.</div>
          <div className="mt-2 space-y-3">
            {cat.checklist.map((c) => (
              <div
                key={c.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-kongsi-ink/30 bg-kongsi-parchment-3 px-3 py-2"
              >
                <span className="text-[13px] font-semibold">{c.q}</span>
                <span className="flex gap-2">
                  {[
                    { v: true, l: "Ya" },
                    { v: false, l: "Tidak" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      aria-pressed={answers[c.key] === o.v}
                      onClick={() => {
                        setErr(null);
                        setAnswers((a) => ({ ...a, [c.key]: o.v }));
                      }}
                      className={cn(chip, "px-4", answers[c.key] === o.v ? chipOn : chipOff)}
                    >
                      {o.l}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="photo">
              Foto barang (kamera langsung)
            </label>
            <input
              id="photo"
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full text-sm"
            />
          </div>
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="want_text">
              Mau ditukar dengan
            </label>
            <input
              id="want_text"
              value={want}
              onChange={(e) => setWant(e.target.value)}
              className={fieldInput}
              placeholder="cth. sepeda / laptop"
            />
          </div>
          <div className="mb-[14px] grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabel} htmlFor="city">
                Kota
              </label>
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={fieldInput}
                placeholder="cth. Sleman"
              />
            </div>
            <div>
              <label className={fieldLabel} htmlFor="tone">
                Warna kartu
              </label>
              <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className={fieldInput}>
                {tones.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pratinjau taksiran */}
      {cat && step > 0 ? (
        <div className="mt-4 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-indigo p-4 text-kongsi-parchment">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">Taksiran Kongsi</div>
          {preview.t ? (
            <>
              <div className="mt-1 font-fraunces text-[26px] font-black leading-tight">
                {formatKeping(preview.t.mid)}
              </div>
              <div className="text-[12px] opacity-85">
                rentang wajar {formatKeping(preview.t.low)} – {formatKeping(preview.t.high)}
                {step >= 2 && !allAnswered ? " · lengkapi kondisi" : ""}
              </div>
              <ul className="mt-2 list-disc pl-4 text-[12px] opacity-85">
                {preview.t.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-1 text-[13px] opacity-85">{preview.why ?? "Lengkapi data barang."}</div>
          )}
        </div>
      ) : null}

      {err ? (
        <p className="mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        {step > 0 ? (
          <KongsiButton type="button" variant="ghost" onClick={() => {
              setErr(null);
              setStep((s) => s - 1);
            }}>
            ← Kembali
          </KongsiButton>
        ) : null}
        {step < LANGKAH.length - 1 ? (
          <KongsiButton type="button" variant="primary" className="flex-1" onClick={next}>
            Lanjut →
          </KongsiButton>
        ) : (
          <KongsiButton type="button" variant="primary" className="flex-1" disabled={saving} onClick={submit}>
            {saving ? "Mengunggah…" : "Unggah Barang"}
          </KongsiButton>
        )}
      </div>
    </div>
  );
}
