import { CompassRose } from "@/components/kongsi/icons";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { Pill } from "@/components/kongsi/Pill";
import { RowHead } from "@/components/kongsi/RowHead";
import Link from "next/link";
import { AjukanTukar, TutupBarang, MintaTera } from "@/components/kongsi/BarterActions";
import { getSessionUser } from "@/lib/auth";
import { getBarterRows, getMyBarter, getWalletBalance, type BarterRow } from "@/lib/queries";
import { labelStatus, STATUS_AKHIR } from "@/lib/domain/tukar-aturan";
import { alamatSaya } from "@/lib/domain/alamat";
import { kirimAktif } from "@/lib/shipping/kiriminaja";
import { isiPundiTersedia } from "@/lib/domain/pundi";
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
          "flex h-24 items-center justify-center overflow-hidden border-b-2 border-kongsi-ink text-kongsi-indigo",
          toneBg[item.tone],
        )}
      >
        {item.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photo_url}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <CompassRose size={30} />
        )}
      </div>
      <div className="px-[14px] py-3">
        <div className="text-sm font-bold">{item.title}</div>
        <div className="my-[3px] text-[11px] text-kongsi-olive">
          {item.city ?? "—"}
        </div>
        <div className="font-fraunces text-[15px] font-black text-kongsi-grenadine">
          ≈ {formatKeping(item.est_value)}
        </div>
        {item.est_low != null && item.est_high != null ? (
          <div className="text-[11px] text-kongsi-ink-soft">
            Taksiran Kongsi{item.categoryName ? ` · ${item.categoryName}` : ""}:{" "}
            {formatKeping(item.est_low)}–{formatKeping(item.est_high)}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Pill variant={akurasiPill[item.accuracy ?? ""]?.variant ?? "indigo"}>
            {akurasiPill[item.accuracy ?? ""]?.label ?? "taksiran lama"}
          </Pill>
          {item.jumlahPembanding > 0 ? (
            <span className="text-[11px] text-kongsi-ink-soft">{item.jumlahPembanding} pembanding pasar</span>
          ) : null}
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

const akurasiPill: Record<string, { label: string; variant: "gold" | "sage" | "indigo" | "live" }> = {
  tinggi: { label: "akurasi tinggi", variant: "sage" },
  sedang: { label: "akurasi sedang", variant: "gold" },
  rendah: { label: "akurasi rendah", variant: "live" },
  ditera: { label: "ditera Penaksir", variant: "indigo" },
};

const dealStatusPill: Record<string, "gold" | "sage" | "indigo" | "live"> = {
  proposed: "gold",
  agreed: "live",
  disputed: "live",
  done: "sage",
  resolved: "sage",
};

export default async function TukarPage() {
  const user = await getSessionUser();

  const rows = await getBarterRows();
  const [{ mine, deals }, balance, alamat] = user
    ? await Promise.all([getMyBarter(user.id), getWalletBalance(user.id), alamatSaya(user.id)])
    : [{ mine: [], deals: [] }, 0, []];
  const bisaKirim = kirimAktif();
  const langsung = isiPundiTersedia() !== null;
  // Tawaran aktif di atas, yang sudah tutup di bawah.
  const sortedDeals = [...deals].sort(
    (x, y) => Number(STATUS_AKHIR.includes(x.status as never)) - Number(STATUS_AKHIR.includes(y.status as never)),
  );

  const others = user ? rows.filter((r) => r.user_id !== user.id) : rows;
  const myItemOptions = mine.map((m) => ({
    id: m.id,
    title: m.title,
    value: m.est_value,
    kirimOk: m.categoryName !== null,
  }));
  const alamatPilihan = alamat.map((a) => ({ id: a.id, label: a.label, area: a.area }));

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
            Unggah barangmu — Kongsi menaksir nilainya. Kalau timpang, yang lebih
            rendah <b>tambah Keteng</b>. Bea Tukar cuma 10% (maks Rp 10.000) per
            pihak, ditahan sampai tukar selesai — ketemuan di Titik Aman (COD) atau
            dikirim kurir.
            Sengketa diadili <b>Syahbandar</b>.
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
                  {it.appraisalStatus === "none" && it.accuracy !== "tinggi" ? <MintaTera id={it.id} /> : null}
                  {it.appraisalStatus === "diminta" ? (
                    <div className="mt-2 text-[11px] font-bold text-kongsi-olive">⏳ Menunggu tera Penaksir</div>
                  ) : null}
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
              {sortedDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/tukar/deal/${d.id}`}
                  className="block rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 shadow-hard-sm transition-transform hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="font-bold">{d.iAmRecipient ? "Masuk" : "Keluar"}</span>
                    <Pill variant={dealStatusPill[d.status] ?? "indigo"}>{labelStatus(d.status)}</Pill>
                  </div>
                  <div className="mt-1 text-[13px]">
                    <b className="text-kongsi-indigo">{d.theirItem}</b> ⇄{" "}
                    <b className="text-kongsi-indigo">{d.myItem}</b>
                    {d.topup > 0 ? (
                      <span className="text-kongsi-ink-soft"> (+{formatKeping(d.topup)})</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[12px] font-bold text-kongsi-grenadine">Buka →</div>
                </Link>
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
                  targetValue={it.est_value}
                  targetKirimOk={it.categoryName !== null}
                  myItems={myItemOptions}
                  loggedIn={Boolean(user)}
                  balance={balance}
                  kirimAktif={bisaKirim}
                  alamat={alamatPilihan}
                  langsung={langsung}
                />
              </BarterCard>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
