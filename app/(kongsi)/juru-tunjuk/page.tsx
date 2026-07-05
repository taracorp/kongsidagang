"use client";

import { useState } from "react";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { cn } from "@/lib/utils";
import { juruHasil } from "@/lib/data-e";

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

export default function JuruTunjukPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  function pick(label: string) {
    const next = [...answers.slice(0, step), label];
    setAnswers(next);
    setStep(step + 1);
  }

  function reset() {
    setStep(0);
    setAnswers([]);
  }

  const done = step >= steps.length;

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
              Ini temuan Juru Tunjuk
            </div>
            <div className="mb-4 text-sm text-kongsi-ink-soft">
              {answers.join(" · ")}
            </div>
            <div className="grid grid-cols-2 gap-4 text-left">
              {juruHasil.map((p) => (
                <ProdukCard
                  key={p.name}
                  name={p.name}
                  shop={p.shop}
                  price={p.price}
                  tone={p.tone}
                  addable
                />
              ))}
            </div>
            <KongsiButton variant="gold" className="mt-[18px]" onClick={reset}>
              Tanya Lagi
            </KongsiButton>
          </div>
        )}
      </div>
    </section>
  );
}
