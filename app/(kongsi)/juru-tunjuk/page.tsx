"use client";

import { useEffect, useState } from "react";
import { ProdukCard, type Tone } from "@/components/kongsi/ProdukCard";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Step = {
  q: string;
  sub: string;
  chips: { em?: string; label: string }[];
};

const steps: Step[] = [
  {
    q: "Mau cari apa hari ini?",
    sub: "Juru Tunjuk siap mengantar ke lorong yang tepat.",
    chips: [
      { em: "🍜", label: "Makanan" },
      { em: "👗", label: "Baju" },
      { em: "🧴", label: "Kecantikan" },
      { em: "🏺", label: "Perabot" },
    ],
  },
  {
    q: "Selera yang mana?",
    sub: "Biar hasilnya pas di lidah.",
    chips: [
      { em: "🌶️", label: "Pedas" },
      { em: "🍯", label: "Manis" },
      { em: "🧂", label: "Gurih" },
    ],
  },
  {
    q: "Kisaran harga?",
    sub: "Sesuaikan dengan isi pundi.",
    chips: [
      { label: "< Rp 25rb" },
      { label: "Rp 25–75rb" },
      { label: "> Rp 75rb" },
    ],
  },
];

const catMap: Record<string, string> = {
  Makanan: "makanan",
  Baju: "baju",
  Kecantikan: "kecantikan",
  Perabot: "perabot",
};
const tasteMap: Record<string, string> = {
  Pedas: "pedas",
  Manis: "manis",
  Gurih: "gurih",
};
const priceMap: Record<string, [number, number]> = {
  "< Rp 25rb": [0, 24999],
  "Rp 25–75rb": [25000, 75000],
  "> Rp 75rb": [75001, 100000000],
};

type Hasil = { name: string; price: number; tone: Tone; shop: string };

export default function JuruTunjukPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<Hasil[] | null>(null);
  const [loading, setLoading] = useState(false);

  const done = step >= steps.length;

  useEffect(() => {
    if (!done || results !== null) return;
    let active = true;
    (async () => {
      setLoading(true);
      const cat = catMap[answers[0]];
      const taste = tasteMap[answers[1]];
      const [min, max] = priceMap[answers[2]] ?? [0, 100000000];
      const tags = cat === "makanan" && taste ? [cat, taste] : [cat];
      const supabase = createClient();
      const { data } = await supabase
        .from("merchant_products")
        .select("name,price,tone,merchants(name)")
        .eq("is_active", true)
        .contains("tags", tags)
        .gte("price", min)
        .lte("price", max)
        .order("price", { ascending: true })
        .limit(6);
      if (!active) return;
      const mapped: Hasil[] = (data ?? []).map((p) => {
        const rel = p.merchants as { name?: string } | { name?: string }[] | null;
        const shop = Array.isArray(rel) ? rel[0]?.name : rel?.name;
        return {
          name: p.name as string,
          price: p.price as number,
          tone: (p.tone as Tone) ?? "sage",
          shop: shop ?? "",
        };
      });
      setResults(mapped);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [done, results, answers]);

  function pick(label: string) {
    setAnswers([...answers.slice(0, step), label]);
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
                i <= Math.min(step, 2)
                  ? "bg-kongsi-grenadine"
                  : "bg-kongsi-parchment-2",
              )}
            />
          ))}
        </div>

        {!done ? (
          <div>
            <div className="mb-[6px] font-fraunces text-[26px] font-black text-kongsi-indigo">
              {steps[step].q}
            </div>
            <div className="mb-[22px] text-sm text-kongsi-ink-soft">
              {steps[step].sub}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {steps[step].chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pick(c.label)}
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
            <div className="mb-4 text-sm text-kongsi-ink-soft">
              {answers.join(" · ")}
            </div>
            {loading ? (
              <div className="py-10 text-kongsi-ink-soft">Sebentar ya…</div>
            ) : results && results.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 text-left">
                {results.map((p) => (
                  <ProdukCard
                    key={`${p.shop}-${p.name}`}
                    name={p.name}
                    shop={p.shop}
                    price={p.price}
                    tone={p.tone}
                    addable
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
