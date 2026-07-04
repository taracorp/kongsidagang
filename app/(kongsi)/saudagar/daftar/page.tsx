import { SaudagarForm } from "@/components/kongsi/SaudagarForm";

const benefits = [
  {
    emoji: "🎯",
    title: "Pembeli didatangkan",
    desc: "Barangmu tampil di lelang, neraca & etalase.",
  },
  {
    emoji: "⚡",
    title: "Obral Kilat terjadwal",
    desc: "Flash sale-mu diramaikan serentak.",
  },
  {
    emoji: "🛡️",
    title: "Cap segel = kepercayaan",
    desc: "Loji bersegel naik peringkat di neraca.",
  },
  {
    emoji: "💰",
    title: "Setelmen jelas",
    desc: "Lewat DOKU, riwayat rapi di Kantor Kongsi.",
  },
];

export default function SaudagarDaftarPage() {
  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Obral Kilat
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Buka lapak di Kongsi
          </h2>
        </div>

        <div className="grid grid-cols-1 items-start gap-[30px] lg:grid-cols-[1.1fr_0.9fr]">
          <SaudagarForm />
          <div>
            <h3 className="mb-[6px] font-fraunces text-[19px] font-black text-kongsi-indigo">
              Kenapa gabung?
            </h3>
            {benefits.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-[11px] border-b-[1.5px] border-dashed border-kongsi-ink/20 py-[11px]"
              >
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-beeswax">
                  {b.emoji}
                </div>
                <div>
                  <b className="font-fraunces text-kongsi-indigo">{b.title}</b>
                  <div className="text-[13px] text-kongsi-ink-soft">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
