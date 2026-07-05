import { CompassRose } from "@/components/kongsi/icons";
import { KongsiLinkButton, KongsiButton } from "@/components/kongsi/KongsiButton";
import { RowHead } from "@/components/kongsi/RowHead";
import { cn, formatKeping } from "@/lib/utils";
import { getBarter } from "@/lib/queries";
import type { Tone } from "@/components/kongsi/ProdukCard";

const toneBg: Record<Tone, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

export default async function TukarPage() {
  const barterItems = await getBarter();
  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Tukar Guling
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Barter antar sesama
          </h2>
        </div>

        <div className="mb-[22px] flex flex-wrap items-center gap-[18px] rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-[22px] py-5 shadow-hard">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-sage">
            <CompassRose size={26} className="text-kongsi-indigo" />
          </div>
          <div className="flex-1">
            <h3 className="font-fraunces text-xl font-black text-kongsi-indigo">
              Punya barang nganggur? Tukar, bukan jual.
            </h3>
            <p className="max-w-[520px] text-[13px] text-kongsi-ink-soft">
              Unggah barangmu + taksiran nilainya. Kalau ada yang cocok, kalian
              sepakati tukar. Boleh <b>tambah keping</b> biar seimbang. Versi
              awal: ketemuan / COD, saling kasih penilaian. Sengketa diadili{" "}
              <b>Syahbandar</b>.
            </p>
          </div>
          <KongsiLinkButton href="/masuk" variant="primary">
            Tawarkan Barangmu
          </KongsiLinkButton>
        </div>

        <RowHead title="Barang yang ditawarkan" note={`${barterItems.length} tawaran aktif`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barterItems.map((it) => (
            <div
              key={it.title}
              className="overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard"
            >
              <div
                className={cn(
                  "flex h-24 items-center justify-center border-b-2 border-kongsi-ink text-kongsi-indigo",
                  toneBg[it.tone],
                )}
              >
                <CompassRose size={30} />
              </div>
              <div className="px-[14px] py-3">
                <div className="text-sm font-bold">{it.title}</div>
                <div className="my-[3px] text-[11px] text-kongsi-olive">
                  oleh {it.owner} · {it.city}
                </div>
                <div className="font-fraunces text-[15px] font-black text-kongsi-grenadine">
                  ≈ {formatKeping(it.estValue)}
                </div>
                <div className="mt-[6px] border-t-[1.5px] border-dashed border-kongsi-ink/20 pt-[6px] text-[12px] text-kongsi-ink-soft">
                  Mau ditukar: <b className="text-kongsi-indigo">{it.want}</b>
                </div>
              </div>
            </div>
          ))}
        </div>

        <RowHead title="Contoh kesepakatan tukar" />
        <div className="grid grid-cols-1 items-center gap-[14px] rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard sm:grid-cols-[1fr_auto_1fr]">
          <div className="text-center">
            <div className="mb-2 flex h-20 items-center justify-center rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment-3 text-kongsi-indigo">
              <CompassRose size={30} />
            </div>
            <div className="text-sm font-bold">Sepatu Lari</div>
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
              Rani · ≈250rb
            </div>
          </div>
          <div className="text-center">
            <div className="text-[28px] font-black text-kongsi-grenadine">⇄</div>
            <div className="mt-[3px] text-[12px] font-bold text-kongsi-olive">
              + Rp 50.000 keping
            </div>
          </div>
          <div className="text-center">
            <div className="mb-2 flex h-20 items-center justify-center rounded-[5px] border-2 border-kongsi-ink bg-kongsi-beeswax text-kongsi-indigo">
              <CompassRose size={30} />
            </div>
            <div className="text-sm font-bold">Jam Tangan Kulit</div>
            <div className="text-[10px] font-bold uppercase tracking-[1px] text-kongsi-olive">
              Tia · ≈300rb
            </div>
          </div>
        </div>
        <p className="mt-[14px] text-center">
          <KongsiButton variant="gold">Setuju &amp; Lanjut Tukar</KongsiButton>
        </p>
      </div>
    </section>
  );
}
