import { cn, formatKeping } from "@/lib/utils";
import { Pill, LiveDot } from "./Pill";
import { KongsiLinkButton } from "./KongsiButton";
import type { AuctionPublic } from "@/lib/queries";

const desc = (s: string): string => {
  const t: Record<string, string> = {
    kumpul: "Menunggu peserta",
    tebak: "Babak tebak dibuka",
    jeda: "Jeda menuju final",
    final: "Babak final",
    pemenang: "Pemenang ditentukan",
    bayar: "Menunggu pembayaran",
    selesai: "Selesai",
  };
  return t[s] ?? s;
};

function AuctionCard({ auction }: { auction: AuctionPublic }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-[6px] border-2 border-kongsi-ink shadow-hard-lg md:grid-cols-[1.1fr_1fr]">
      <div className="relative flex flex-col justify-center bg-gradient-to-br from-kongsi-indigo to-kongsi-indigo-dark p-[26px] text-kongsi-parchment">
        <Pill
          variant="live"
          className="absolute left-[14px] top-[14px] inline-flex items-center gap-[6px]"
        >
          <LiveDot live />
          Lelang {auction.type === "vendu" ? "Vendu" : "Reguler"} ·{" "}
          {desc(auction.status)}
        </Pill>
        <div className="mt-[14px] font-fraunces text-2xl font-black">
          {auction.clue_category}
        </div>
        <div className="mt-[2px] text-sm opacity-85">
          Nama loji:{" "}
          <b className="font-fraunces tracking-[3px] text-kongsi-beeswax">
            {auction.clue_name_masked}
          </b>{" "}
          · disamarkan sampai menang
        </div>
      </div>
      <div className="flex flex-col justify-center bg-kongsi-parchment p-6 text-center">
        <div className="font-fraunces text-[44px] font-black leading-none text-kongsi-grenadine">
          {auction.status === "kumpul" ? "—" : "••••••"}
          <small className="block font-work text-[10px] font-bold uppercase tracking-[2px] text-kongsi-olive">
            {auction.status === "kumpul" ? "menunggu peserta" : "tebakan disamarkan"}
          </small>
        </div>
        <div className="my-3 text-sm text-kongsi-ink-soft">
          Harga normal{" "}
          <b className="font-fraunces text-lg text-kongsi-grenadine line-through">
            {formatKeping(auction.normal_price)}
          </b>
        </div>
        <KongsiLinkButton href="/lelang" variant="primary" block className="mt-3">
          {auction.status === "kumpul" ? "Ikut Lelang" : "Lihat Balai"}
        </KongsiLinkButton>
      </div>
    </div>
  );
}

function AdSlot() {
  const image = process.env.NEXT_PUBLIC_AD_IMAGE_URL;
  const video = process.env.NEXT_PUBLIC_AD_VIDEO_URL;

  return (
    <div className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 p-6 text-center text-kongsi-ink-soft">
      <Pill
        variant="indigo"
        className={cn(
          "mb-[14px] inline-flex items-center gap-[6px]",
          !image && !video && "opacity-70",
        )}
      >
        <LiveDot live={false} />
        Sekilas Pariwara
      </Pill>
      {video ? (
        <video
          src={video}
          controls={false}
          autoPlay
          muted
          loop
          playsInline
          className="mx-auto max-h-[300px] rounded-[4px]"
        />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt="Pariwara"
          className="mx-auto max-h-[300px] rounded-[4px]"
        />
      ) : (
        <div className="py-8">
          <h3 className="font-fraunces text-xl font-black text-kongsi-indigo">
            Belum ada lelang berjalan
          </h3>
          <p className="mt-[6px] text-sm">
            Saat balai kosong, ruang ini diisi iklan saudagar atau video promosi
            Pekan Raya.
          </p>
        </div>
      )}
    </div>
  );
}

export function LiveAuction({ auction }: { auction: AuctionPublic | null }) {
  return (
    <div>
      {auction ? <AuctionCard auction={auction} /> : <AdSlot />}
      <p className="mt-[10px] text-[12px] text-kongsi-ink-soft">
        ◆ <b>Lelang Reguler</b> terbuka untuk siapa saja (daftar hanya saat mau
        menebus). <b>Vendu</b> (lelang khusus) hanya untuk yang sudah masuk loji.
      </p>
    </div>
  );
}
