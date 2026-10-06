"use client";

import { useEffect, useState } from "react";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { cariJuruTunjuk, kotaJuruTunjuk } from "@/app/actions/loji";
import type { ProdukTampil } from "@/lib/queries-lapak";
import { cn } from "@/lib/utils";

type Chip = { em?: string; label: string; nilai: string };
type Step = { q: string; sub: string; chips: Chip[] };

// Kebutuhan → tag produk (diisi di Kelola Lapak / skrip data tenant).
const KEBUTUHAN: Chip[] = [
  { em: "🫧", label: "Jerawat", nilai: "jerawat" },
  { em: "✨", label: "Kusam & glow", nilai: "glow" },
  { em: "🌿", label: "Penuaan", nilai: "anti-aging" },
  { em: "🎯", label: "Flek & pigmen", nilai: "flek" },
  { em: "🌸", label: "Kemerahan", nilai: "kemerahan" },
  { em: "🪒", label: "Bulu halus", nilai: "bulu" },
  { em: "💇", label: "Rambut", nilai: "rambut" },
];
const ANGGARAN: Chip[] = [
  { label: "< Rp 150rb", nilai: "0-149999" },
  { label: "Rp 150–250rb", nilai: "150000-250000" },
  { label: "> Rp 250rb", nilai: "250001-100000000" },
  { label: "Berapa saja", nilai: "0-100000000" },
];

export default function JuruTunjukPage() {
  const [kota, setKota] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Chip[]>([]);
  const [results, setResults] = useState<ProdukTampil[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    kotaJuruTunjuk().then(({ data }) => setKota(data ?? []));
  }, []);

  const steps: Step[] = [
    { q: "Mau merawat apa?", sub: "Pilih kebutuhan utamamu.", chips: KEBUTUHAN },
    {
      q: "Di daerah mana?",
      sub: "Voucher ditebus di cabang pilihanmu.",
      chips: [...kota.map((k) => ({ em: "📍", label: k, nilai: k })), { em: "🗺️", label: "Mana saja", nilai: "" }],
    },
    { q: "Kisaran harga?", sub: "Sesuaikan dengan isi Pundi.", chips: ANGGARAN },
  ];
  const done = step >= steps.length;

  useEffect(() => {
    if (!done || results !== null) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [min, max] = answers[2].nilai.split("-").map(Number);
      const { data } = await cariJuruTunjuk(answers[0].nilai, min, max, answers[1].nilai || null);
      if (!active) return;
      setResults(data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [done, results, answers]);

  function pick(c: Chip) {
    setAnswers([...answers.slice(0, step), c]);
    setStep(step + 1);
  }

  function reset() {
    setStep(0);
    setAnswers([]);
    setResults(null);
  }

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[520px] px-5 text-center">
        <div className="mx-auto mb-[14px] flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-beeswax text-[34px]">
          {done ? "✨" : "🧭"}
        </div>
        <div className="mb-[26px] flex justify-center gap-[6px]">
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              className={cn(
                "h-[6px] w-9 rounded-[3px] border-[1.5px] border-kongsi-ink",
                i <= Math.min(step, 2) ? "bg-kongsi-grenadine" : "bg-kongsi-parchment-2",
              )}
            />
          ))}
        </div>

        {!done ? (
          <div>
            <div className="mb-[6px] font-fraunces text-[26px] font-black text-kongsi-indigo">{steps[step].q}</div>
            <div className="mb-[22px] text-sm text-kongsi-ink-soft">{steps[step].sub}</div>
            <div className="flex flex-wrap justify-center gap-3">
              {steps[step].chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pick(c)}
                  className="flex min-w-[110px] cursor-pointer flex-col items-center gap-[6px] rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment px-[22px] py-4 text-[15px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-kongsi-beeswax"
                >
                  {c.em ? <span className="text-[26px]">{c.em}</span> : null}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-[6px] font-fraunces text-[26px] font-black text-kongsi-indigo">
              {loading ? "Juru Tunjuk mencari…" : "Ini temuan Juru Tunjuk"}
            </div>
            <div className="mb-4 text-sm text-kongsi-ink-soft">{answers.map((a) => a.label).join(" · ")}</div>
            {loading ? (
              <div className="py-10 text-kongsi-ink-soft">Sebentar ya…</div>
            ) : results && results.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 text-left">
                {results.map((p) => (
                  <ProdukCard
                    key={p.id}
                    name={p.name}
                    shop={p.shop}
                    shopHref={`/lapak/${p.shopSlug}`}
                    price={p.price}
                    tone={p.tone}
                    logo={p.logo}
                    note={`E-voucher · berlaku ${p.validDays} hari`}
                    cart={{ productId: p.id, name: p.name, shop: p.shop, price: p.price, tone: p.tone, branches: p.branches }}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-8 text-[13px] text-kongsi-ink-soft">
                Belum ada yang pas untuk pilihan itu. Coba kombinasi lain.
              </div>
            )}
            <KongsiButton variant="gold" className="mt-[18px]" onClick={reset}>
              Tanya Lagi
            </KongsiButton>
          </div>
        )}
      </div>
    </section>
  );
}
