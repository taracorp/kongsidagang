import Link from "next/link";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { Pill } from "@/components/kongsi/Pill";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { RowHead } from "@/components/kongsi/RowHead";
import { LiveAuction } from "@/components/kongsi/LiveAuction";
import { getFeatured, getActiveAuction, getAdSettings } from "@/lib/queries";

export default async function Beranda() {
  const [featured, auction, ad] = await Promise.all([
    getFeatured(),
    getActiveAuction("reguler"),
    getAdSettings(),
  ]);
  const { etalase, pilihan } = featured;
  return (
    <>
      <header className="pb-[22px] pt-10 text-center">
        <div className="mx-auto max-w-[1080px] px-5">
          <div className="mb-3 inline-flex items-center gap-[9px] font-fraunces text-[15px] font-semibold italic text-kongsi-olive before:h-px before:w-[34px] before:bg-kongsi-olive after:h-px after:w-[34px] after:bg-kongsi-olive">
            Anno 1602 — dihidupkan kembali
          </div>
          <h1 className="font-fraunces text-[52px] font-black leading-[0.93] text-kongsi-indigo [text-shadow:2px_2px_0_rgba(231,162,74,0.5)]">
            Kongsi{" "}
            <span className="font-medium italic text-kongsi-grenadine">&amp;</span>{" "}
            Dagang
          </h1>
          <p className="mx-auto mt-4 max-w-[540px] text-base text-kongsi-ink-soft">
            Balai lelang, neraca harga, dan loji para saudagar — satu jalur
            perdagangan tempat kamu menawar, menimbang, dan berbelanja dengan
            seru.
          </p>
        </div>
        <div className="mt-[26px] h-[13px] border-y-2 border-kongsi-ink [background:repeating-linear-gradient(90deg,var(--color-kongsi-grenadine)_0_18px,var(--color-kongsi-beeswax)_18px_36px,var(--color-kongsi-indigo)_36px_54px,var(--color-kongsi-sage)_54px_72px)]" />
      </header>

      <section className="py-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <RowHead
            title="Lelang yang sedang berlangsung"
            moreHref="/lelang"
            moreLabel="Masuk balai"
          />
          <LiveAuction auction={auction} ad={ad} />
        </div>
      </section>

      <section className="pb-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <div className="flex flex-wrap items-center gap-5 rounded-[6px] border-2 border-kongsi-ink bg-gradient-to-br from-kongsi-beeswax to-kongsi-grenadine px-6 py-[22px] text-kongsi-ink shadow-hard-lg">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-parchment text-[28px]">
              🧭
            </div>
            <div className="flex-1">
              <h3 className="font-fraunces text-[22px] font-black">
                Bingung cari apa? Panggil Juru Tunjuk.
              </h3>
              <p className="max-w-[440px] text-sm">
                Pelayan Kongsi bakal nanya beberapa hal — mau makanan atau baju,
                pedas atau manis, kisaran harga — lalu menunjukkan barang yang
                pas.
              </p>
            </div>
            <KongsiLinkButton href="/juru-tunjuk" variant="primary">
              Panggil Juru Tunjuk
            </KongsiLinkButton>
          </div>
        </div>
      </section>

      <section className="pb-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <RowHead title="Etalase — Pilihan Kurator" moreHref="/loji" />
          <div className="flex gap-[14px] overflow-x-auto pb-2">
            {etalase.map((p) => (
              <ProdukCard
                key={p.name}
                {...p}
                addable
                className="min-w-[158px]"
                ribbon={<Pill variant="gold">Kurasi</Pill>}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="pb-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <RowHead title="Pilihan Untukmu" note="berdasarkan minatmu" />
          <div className="grid grid-cols-2 gap-4">
            {pilihan.map((p) => (
              <ProdukCard key={p.name} {...p} addable />
            ))}
          </div>
          <p className="mt-4 text-center text-[12px] text-kongsi-ink-soft">
            Keliling &amp; isi keranjang tak perlu akun.{" "}
            <Link href="/masuk" className="font-bold text-kongsi-grenadine">
              Masuk Loji
            </Link>{" "}
            hanya saat mau menebus.
          </p>
        </div>
      </section>
    </>
  );
}
