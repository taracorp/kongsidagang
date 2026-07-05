import { CompassRose } from "@/components/kongsi/icons";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { Pill } from "@/components/kongsi/Pill";
import { RowHead } from "@/components/kongsi/RowHead";
import {
  AjukanTukar,
  TutupBarang,
  DealActions,
} from "@/components/kongsi/BarterActions";
import { createClient } from "@/lib/supabase/server";
import { getBarterRows, getMyBarter, type BarterRow } from "@/lib/queries";
import { cn, formatKeping } from "@/lib/utils";
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

function BarterCard({
  item,
  children,
}: {
  item: BarterRow;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
      <div
        className={cn(
          "flex h-24 items-center justify-center border-b-2 border-kongsi-ink text-kongsi-indigo",
          toneBg[item.tone],
        )}
      >
        <CompassRose size={30} />
      </div>
      <div className="px-[14px] py-3">
        <div className="text-sm font-bold">{item.title}</div>
        <div className="my-[3px] text-[11px] text-kongsi-olive">
          {item.city ?? "—"}
        </div>
        <div className="font-fraunces text-[15px] font-black text-kongsi-grenadine">
          ≈ {formatKeping(item.est_value)}
        </div>
        {item.want_text ? (
          <div className="mt-[6px] border-t-[1.5px] border-dashed border-kongsi-ink/20 pt-[6px] text-[12px] text-kongsi-ink-soft">
            Mau ditukar: <b className="text-kongsi-indigo">{item.want_text}</b>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

const dealStatusPill: Record<string, "gold" | "sage" | "indigo"> = {
  proposed: "gold",
  agreed: "sage",
  done: "indigo",
  ditolak: "indigo",
};

export default async function TukarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = await getBarterRows();
  const { mine, deals } = user
    ? await getMyBarter(user.id)
    : { mine: [], deals: [] };

  const others = user ? rows.filter((r) => r.user_id !== user.id) : rows;
  const myItemOptions = mine.map((m) => ({ id: m.id, title: m.title }));

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

        <div className="mb-[22px] flex flex-col items-center gap-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-[22px] py-5 text-center shadow-hard">
          <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-sage">
            <CompassRose size={26} className="text-kongsi-indigo" />
          </div>
          <h3 className="font-fraunces text-xl font-black text-kongsi-indigo">
            Punya barang nganggur? Tukar, bukan jual.
          </h3>
          <p className="text-[13px] text-kongsi-ink-soft">
            Unggah barangmu + taksiran nilainya. Kalau ada yang cocok, kalian
            sepakati tukar. Boleh <b>tambah keping</b> biar seimbang. Versi awal:
            ketemuan / COD, saling kasih penilaian. Sengketa diadili{" "}
            <b>Syahbandar</b>.
          </p>
          <KongsiLinkButton
            href={user ? "/tukar/tawarkan" : "/masuk"}
            variant="primary"
            block
            className="mt-1"
          >
            Tawarkan Barangmu
          </KongsiLinkButton>
        </div>

        {user && mine.length > 0 ? (
          <>
            <RowHead title="Barangku" note={`${mine.length} aktif`} />
            <div className="mb-6 grid grid-cols-2 gap-4">
              {mine.map((it) => (
                <BarterCard key={it.id} item={it}>
                  <TutupBarang id={it.id} />
                </BarterCard>
              ))}
            </div>
          </>
        ) : null}

        {user && deals.length > 0 ? (
          <>
            <RowHead title="Tawaran Tukar" note={`${deals.length}`} />
            <div className="mb-6 space-y-2">
              {deals.map((d) => (
                <div
                  key={d.id}
                  className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 shadow-hard-sm"
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-bold">
                      {d.iAmRecipient ? "Masuk" : "Keluar"}
                    </span>
                    <Pill variant={dealStatusPill[d.status] ?? "indigo"}>
                      {d.status}
                    </Pill>
                  </div>
                  <div className="mt-1 text-[13px]">
                    <b className="text-kongsi-indigo">{d.theirItem}</b> ⇄{" "}
                    <b className="text-kongsi-indigo">{d.myItem}</b>
                    {d.topup > 0 ? (
                      <span className="text-kongsi-ink-soft">
                        {" "}
                        (+{formatKeping(d.topup)})
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2">
                    <DealActions
                      id={d.id}
                      status={d.status}
                      iAmRecipient={d.iAmRecipient}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <RowHead
          title="Barang yang ditawarkan"
          note={`${others.length} tawaran aktif`}
        />
        {others.length === 0 ? (
          <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada tawaran dari saudagar lain.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {others.map((it) => (
              <BarterCard key={it.id} item={it}>
                <AjukanTukar
                  targetId={it.id}
                  myItems={myItemOptions}
                  loggedIn={Boolean(user)}
                />
              </BarterCard>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
