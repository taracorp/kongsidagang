"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tawarkanBarang, cariHargaPasar } from "@/app/actions/tukar";
import { taksir, type Taksiran, type TaksiranCategory } from "@/lib/domain/taksiran";
import type { Pembanding, Statistik } from "@/lib/taksir/ekstrak";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";
import { Pill } from "./Pill";

const fieldLabel = "mb-[5px] block text-[13px] font-bold";
const fieldInput =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
// Tombol pilihan = pola .jt-chip (Juru Tunjuk): kotak, border tebal, bayangan keras.
const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-4 py-[10px] text-[14px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";
const pilihanOn = "bg-kongsi-grenadine text-kongsi-parchment";
const pilihanOff = "bg-kongsi-parchment text-kongsi-ink hover:bg-kongsi-beeswax";

const tones = ["sage", "beeswax", "beeswax-dark", "grenadine", "grenadine-dark", "olive", "indigo"];
const LANGKAH = ["Kategori", "Data barang", "Kondisi", "Foto & tukar"];
const IKON: Record<string, string> = {
  beras: "🌾",
  gula: "🍬",
  "minyak-goreng": "🛢️",
  sepeda: "🚲",
  hp: "📱",
  laptop: "💻",
  "elektronik-rumah": "📺",
  buku: "📚",
  fashion: "👕",
  lainnya: "📦",
};
const CONTOH: Record<string, string> = {
  sepeda: "cth. Sepeda Polygon Cascade 4 27.5",
  hp: "cth. Samsung Galaxy A54 8/256",
  laptop: "cth. Lenovo IdeaPad Slim 3 Ryzen 5",
  "elektronik-rumah": "cth. TV LED Polytron PLD 32T1850 32 inch",
  buku: "cth. Novel Bumi Manusia Pramoedya cetakan 1",
  fashion: "cth. Sepatu Nike Air Force 1 ukuran 42",
  lainnya: "cth. Kamera analog Canon AE-1",
};
const AKURASI: Record<string, { label: string; variant: "sage" | "gold" | "live" }> = {
  tinggi: { label: "Akurasi tinggi", variant: "sage" },
  sedang: { label: "Akurasi sedang", variant: "gold" },
  rendah: { label: "Akurasi rendah", variant: "live" },
};

type Riset = {
  id: string;
  statistik: Statistik;
  pembanding: Pembanding[];
  jumlah: number;
  sumberOk: string[];
  dariCache: boolean;
};

export function TawarkanForm({ categories, nowYear }: { categories: TaksiranCategory[]; nowYear: number }) {
  const router = useRouter();
  const photoRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [bought, setBought] = useState<"baru" | "bekas" | null>(null);
  const [price, setPrice] = useState("");
  const [year, setYear] = useState("");
  const [prodYear, setProdYear] = useState("");
  const [koleksi, setKoleksi] = useState(false);
  const [serial, setSerial] = useState("");
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [want, setWant] = useState("");
  const [city, setCity] = useState("");
  const [tone, setTone] = useState("sage");
  const [riset, setRiset] = useState<Riset | null>(null);
  const [mencari, setMencari] = useState(false);
  const [errRiset, setErrRiset] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cat = categories.find((c) => c.slug === slug) ?? null;
  const aset = cat?.kind === "aset";
  const digits = (s: string) => Number(s.replace(/\D/g, ""));

  // Data yang memengaruhi riset berubah → hasil riset lama tidak berlaku.
  function ubahRiset<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setRiset(null);
      setErrRiset(null);
    };
  }

  // Pratinjau — server menghitung ulang saat disimpan.
  const preview = useMemo<{ t: Taksiran | null; why: string | null }>(() => {
    if (!cat) return { t: null, why: null };
    try {
      const t = taksir(cat, {
        qty: Number(qty.replace(",", ".")),
        purchasePrice: digits(price),
        purchaseYear: digits(year),
        productionYear: digits(prodYear) || undefined,
        boughtCondition: bought ?? "baru",
        isCollectible: koleksi,
        answers,
        nowYear,
        pasar: riset?.statistik ?? null,
      });
      return { t, why: null };
    } catch (e) {
      return { t: null, why: e instanceof Error ? e.message : null };
    }
  }, [cat, qty, price, year, prodYear, bought, koleksi, answers, nowYear, riset]);

  const allAnswered = !!cat && cat.checklist.every((c) => c.key in answers);

  async function cariPasar() {
    if (!cat) return;
    if (title.trim().length < 4) {
      setErrRiset("Tulis nama & tipe barang dulu.");
      return;
    }
    setMencari(true);
    setErrRiset(null);
    const { data, error } = await cariHargaPasar(title.trim(), cat.slug, koleksi);
    setMencari(false);
    if (error) {
      setErrRiset(error);
      return;
    }
    setRiset(data ?? null);
  }

  function validate(s: number): string | null {
    if (s === 0 && !cat) return "Pilih kategori dulu.";
    if (s === 1) {
      if (!title.trim()) return "Isi nama & tipe barang.";
      if (aset && !bought) return "Pilih kondisi saat kamu membeli: baru atau bekas.";
      if (aset && !riset) return "Tekan \"Cari harga pasar\" dulu supaya taksiran berdasar harga nyata.";
      if (preview.why) return preview.why;
      if (cat?.needs_serial && !serial.trim()) return `Isi ${cat.serial_label ?? "nomor seri"}.`;
    }
    if (s === 2 && !allAnswered) return "Jawab semua pertanyaan kondisi — ini jadi patokan bila ada sengketa.";
    return null;
  }

  function pindah(ke: number) {
    setErr(null);
    setStep(ke);
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
    f.set("production_year", prodYear);
    f.set("bought_condition", bought ?? "baru");
    f.set("is_collectible", koleksi ? "true" : "false");
    f.set("research_id", riset?.id ?? "");
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
      {/* Penanda langkah — pola bar Juru Tunjuk */}
      <div className="mb-[6px] flex justify-center gap-[6px]">
        {LANGKAH.map((l, i) => (
          <i
            key={l}
            className={cn(
              "h-[6px] w-9 rounded-[3px] border-[1.5px] border-kongsi-ink",
              i <= step ? "bg-kongsi-grenadine" : "bg-kongsi-parchment-2",
            )}
          />
        ))}
      </div>
      <div className="mb-4 text-center text-[12px] font-bold text-kongsi-ink-soft">
        Langkah {step + 1} dari {LANGKAH.length} · {LANGKAH[step]}
      </div>

      {step === 0 ? (
        <div>
          <div className="mb-3 text-center font-fraunces text-[22px] font-black text-kongsi-indigo">
            Barang apa yang mau kamu tukar?
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={slug === c.slug}
                onClick={() => {
                  setErr(null);
                  setSlug(c.slug);
                  setAnswers({});
                  setRiset(null);
                  setErrRiset(null);
                }}
                className={cn(
                  "flex min-w-[104px] cursor-pointer flex-col items-center gap-[6px] rounded-[6px] border-2 border-kongsi-ink px-4 py-3 text-[14px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]",
                  slug === c.slug ? pilihanOn : pilihanOff,
                )}
              >
                <span className="text-[24px]">{IKON[c.slug] ?? "📦"}</span>
                {c.name}
              </button>
            ))}
          </div>
          {cat ? (
            <p className="mt-4 text-center text-[12px] text-kongsi-ink-soft">
              {aset
                ? "Juru Taksir akan membandingkan harga barang serupa di Tokopedia, Shopee, Lazada, Blibli, OLX & toko lain."
                : `Ditaksir dari harga pasar terkini${cat.price_per_unit ? ` (${formatKeping(cat.price_per_unit)}/${cat.unit})` : ""}.`}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 1 && cat ? (
        <div>
          <div className="mb-[14px]">
            <label className={fieldLabel} htmlFor="title">
              {aset ? "Nama & tipe lengkap (merek, seri, ukuran)" : "Nama barang"}
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => ubahRiset(setTitle)(e.target.value)}
              className={fieldInput}
              placeholder={aset ? (CONTOH[cat.slug] ?? "cth. merek + seri") : `cth. ${cat.name} 1 karung`}
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
            <>
              <div className="mb-[14px]">
                <div className={fieldLabel}>Saat kamu membeli, barangnya…</div>
                <div className="flex gap-3">
                  {(["baru", "bekas"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={bought === k}
                      onClick={() => {
                        setErr(null);
                        setBought(k);
                      }}
                      className={cn(pilihan, "flex-1", bought === k ? pilihanOn : pilihanOff)}
                    >
                      {k === "baru" ? "Baru" : "Bekas / second"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-[14px] grid grid-cols-2 gap-3">
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
                    placeholder={`cth. ${nowYear - 2}`}
                  />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="prod">
                    Tahun rilis/produksi <span className="font-normal text-kongsi-ink-soft">(opsional)</span>
                  </label>
                  <input
                    id="prod"
                    inputMode="numeric"
                    maxLength={4}
                    value={prodYear}
                    onChange={(e) => setProdYear(e.target.value.replace(/\D/g, ""))}
                    className={fieldInput}
                    placeholder="bila tahu"
                  />
                </div>
              </div>
              <div className="mb-[14px]">
                <label className={fieldLabel} htmlFor="price">
                  Harga beli dulu (Rp){" "}
                  <span className="font-normal text-kongsi-ink-soft">(opsional bila harga pasar ditemukan)</span>
                </label>
                <input
                  id="price"
                  inputMode="numeric"
                  value={price ? digits(price).toLocaleString("id-ID") : ""}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                  className={fieldInput}
                  placeholder="cth. 2.500.000"
                />
              </div>
              <div className="mb-[14px]">
                <button
                  type="button"
                  aria-pressed={koleksi}
                  onClick={() => ubahRiset(setKoleksi)(!koleksi)}
                  className={cn(pilihan, "w-full text-left", koleksi ? pilihanOn : pilihanOff)}
                >
                  {koleksi ? "☑" : "☐"} Barang koleksi / klasik / antik{" "}
                  <span className="font-normal">— nilainya bisa naik, tidak disusutkan</span>
                </button>
              </div>
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
              <KongsiButton type="button" variant="gold" block disabled={mencari} onClick={cariPasar}>
                {mencari ? "Menelusuri harga di toko & marketplace…" : riset ? "🔎 Cari ulang harga pasar" : "🔎 Cari harga pasar"}
              </KongsiButton>
              {errRiset ? <p className="mt-2 text-[13px] font-semibold text-kongsi-bad">{errRiset}</p> : null}
            </>
          )}
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
                      className={cn(pilihan, "px-4 py-[6px]", answers[c.key] === o.v ? pilihanOn : pilihanOff)}
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
            <input id="photo" ref={photoRef} type="file" accept="image/*" capture="environment" className="w-full text-sm" />
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
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className={fieldInput} placeholder="cth. Sleman" />
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

      {/* Taksiran Kongsi */}
      {cat && step > 0 && (!aset || riset || preview.t) ? (
        <div className="mt-4 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-indigo p-4 text-kongsi-parchment">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">Taksiran Kongsi</div>
            {preview.t && AKURASI[preview.t.akurasi] ? (
              <Pill variant={AKURASI[preview.t.akurasi].variant}>{AKURASI[preview.t.akurasi].label}</Pill>
            ) : null}
          </div>
          {preview.t ? (
            <>
              <div className="mt-1 font-fraunces text-[26px] font-black leading-tight">{formatKeping(preview.t.mid)}</div>
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
          {riset ? (
            <div className="mt-3 border-t-[1.5px] border-dashed border-kongsi-parchment/40 pt-2">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[1.5px] opacity-85">
                Pembanding ({riset.jumlah}) · {riset.sumberOk.join(", ") || "tanpa sumber"}
                {riset.dariCache ? " · data ≤7 hari" : ""}
              </div>
              {riset.pembanding.length ? (
                <ul className="space-y-[3px] text-[12px]">
                  {riset.pembanding.slice(0, 8).map((p) => (
                    <li key={p.url} className="flex items-baseline justify-between gap-2">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 flex-1 truncate underline decoration-kongsi-parchment/40 underline-offset-2"
                      >
                        {p.sumber} · {p.kondisi} · {p.judul}
                      </a>
                      <b className="flex-none font-fraunces">{formatKeping(p.harga)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] opacity-85">
                  Belum ada barang serupa di pasar. Taksiran memakai harga beli; setelah tayang kamu bisa minta tera Penaksir.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {err ? (
        <p className="mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        {step > 0 ? (
          <KongsiButton type="button" variant="ghost" onClick={() => pindah(step - 1)}>
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
