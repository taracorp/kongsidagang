import { notFound } from "next/navigation";
import { CompassRose } from "@/components/kongsi/icons";
import { SegelBadge, Pill } from "@/components/kongsi/Pill";
import { Stars } from "@/components/kongsi/PintuCard";
import { FollowButton } from "@/components/kongsi/FollowButton";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { getIsFollowing } from "@/lib/queries";
import { getLapakDetail } from "@/lib/queries-lapak";

const toneBg: Record<string, string> = {
  sage: "bg-kongsi-sage",
  beeswax: "bg-kongsi-beeswax",
  "beeswax-dark": "bg-kongsi-beeswax-dark",
  grenadine: "bg-kongsi-grenadine",
  "grenadine-dark": "bg-kongsi-grenadine-dark",
  olive: "bg-kongsi-olive",
  indigo: "bg-kongsi-indigo",
};

function waLink(nomor: string) {
  const n = nomor.replace(/\D/g, "").replace(/^0/, "62");
  return `https://wa.me/${n}`;
}

export default async function LapakDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = await getLapakDetail(slug);
  if (!l) notFound();
  const follow = await getIsFollowing(l.id);
  const jumlah = l.kelompok.reduce((s, k) => s + k.products.length, 0);

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] overflow-hidden rounded-[6px] border-2 border-kongsi-ink shadow-hard-lg">
          <div className={`flex h-[130px] items-center justify-center ${toneBg[l.tone] ?? "bg-kongsi-indigo"}`}>
            {l.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.logo} alt={l.name} className="max-h-[84px] max-w-[70%] object-contain" />
            ) : (
              <CompassRose size={48} className="text-kongsi-parchment opacity-90" />
            )}
          </div>
          <div className="bg-kongsi-parchment px-[22px] py-[18px]">
            <h2 className="flex flex-wrap items-center gap-[9px] font-fraunces text-[25px] font-black text-kongsi-indigo">
              {l.name}
              {l.sealed ? <SegelBadge label="Saudagar Bersegel" /> : null}
              {l.status === "segera" ? <Pill variant="indigo">Segera hadir</Pill> : null}
            </h2>
            <div className="text-[13px] text-kongsi-ink-soft">
              {l.category}
              {l.city ? ` · ${l.city}` : ""} · <Stars rating={l.rating} />
              {l.tebusan ? ` (${l.tebusan.toLocaleString("id-ID")} tebusan)` : ""}
            </div>
            {l.description ? <p className="mt-2 text-[14px]">{l.description}</p> : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              {l.hours ? <span>🕘 {l.hours}</span> : null}
              {l.whatsapp ? (
                <a href={waLink(l.whatsapp)} target="_blank" rel="noopener noreferrer" className="font-bold text-kongsi-grenadine">
                  WhatsApp {l.whatsapp}
                </a>
              ) : null}
              {l.website ? (
                <a href={l.website} target="_blank" rel="noopener noreferrer" className="font-bold text-kongsi-grenadine">
                  Situs resmi ↗
                </a>
              ) : null}
            </div>
            <div className="mt-3">
              <FollowButton merchantId={l.id} loggedIn={follow.loggedIn} initialFollowing={follow.following} />
            </div>
          </div>
        </div>

        {l.status === "segera" ? (
          <p className="mb-6 rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
            Lapak ini segera hadir. Ikuti lapaknya supaya kamu dapat kabar saat perawatannya mulai dijual.
          </p>
        ) : null}

        {l.flashSaleEndsAt ? (
          <div className="mb-4">
            <Pill variant="live">🔥 Obral Kilat sampai {new Date(l.flashSaleEndsAt).toLocaleString("id-ID")}</Pill>
          </div>
        ) : null}

        {l.kelompok.map((k) => (
          <div key={k.category} className="mb-6">
            <h3 className="mb-3 font-fraunces text-[20px] font-black text-kongsi-indigo">{k.category}</h3>
            <div className="grid grid-cols-2 gap-4">
              {k.products.map((p) => (
                <ProdukCard
                  key={p.id}
                  name={p.name}
                  shop={l.name}
                  price={p.price}
                  oldPrice={p.oldPrice}
                  tone={p.tone}
                  logo={l.logo}
                  note={`E-voucher · berlaku ${p.validDays} hari`}
                  cart={
                    l.status === "buka" || l.status === "obral"
                      ? { productId: p.id, name: p.name, shop: l.name, price: p.price, tone: p.tone, branches: p.branches }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {jumlah === 0 && l.status !== "segera" ? (
          <p className="mb-6 text-center text-[13px] text-kongsi-ink-soft">Belum ada perawatan yang dijual.</p>
        ) : null}

        {l.branches.length ? (
          <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
            <h3 className="mb-3 font-fraunces text-[20px] font-black text-kongsi-indigo">Cabang ({l.branches.length})</h3>
            <ul className="space-y-2 text-[13px]">
              {l.branches.map((b) => (
                <li key={b.id} className="border-b-[1.5px] border-dashed border-kongsi-ink/20 pb-2 last:border-b-0">
                  <b>{b.name}</b>
                  {b.city ? <span className="text-kongsi-olive"> · {b.city}</span> : null}
                  <div className="text-kongsi-ink-soft">{b.address}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
