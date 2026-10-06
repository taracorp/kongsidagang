import Link from "next/link";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { Pill } from "@/components/kongsi/Pill";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { RowHead } from "@/components/kongsi/RowHead";
import { LiveAuction } from "@/components/kongsi/LiveAuction";
import { getActiveAuction, getAdSettings } from "@/lib/queries";
import { getFeatured, type ProdukTampil } from "@/lib/queries-lapak";
import { getSessionUser } from "@/lib/auth";

const keKeranjang = (p: ProdukTampil) => ({
  productId: p.id,
  name: p.name,
  shop: p.shop,
  price: p.price,
  tone: p.tone,
  branches: p.branches,
});

export default async function Beranda() {
  const user = await getSessionUser();
  const [featured, auction, ad] = await Promise.all([
    getFeatured(user?.id ?? null),
    getActiveAuction("reguler"),
    getAdSettings(),
  ]);
  const { etalase, pilihan, pilihanDari } = featured;
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
            Balai lelang, neraca harga, dan lapak para saudagar — satu jalur
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
          <div className="flex flex-col items-center gap-3 rounded-[6px] border-2 border-kongsi-ink bg-gradient-to-br from-kongsi-beeswax to-kongsi-grenadine px-6 py-[22px] text-center text-kongsi-ink shadow-hard-lg">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full border-2 border-kongsi-ink bg-kongsi-parchment text-[28px]">
              🧭
            </div>
            <h3 className="font-fraunces text-[22px] font-black leading-tight">
              Bingung cari apa? Panggil Juru Tunjuk.
            </h3>
            <p className="text-sm">
              Pelayan Kongsi bakal nanya beberapa hal — kebutuhan perawatanmu,
              daerah cabang, dan kisaran harga — lalu menunjukkan yang pas.
            </p>
            <KongsiLinkButton
              href="/juru-tunjuk"
              variant="primary"
              block
              className="mt-1"
            >
              Panggil Juru Tunjuk
            </KongsiLinkButton>
          </div>
        </div>
      </section>

      <section className="pb-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <RowHead title="Etalase — Pilihan Kurator" moreHref="/lapak" />
          {etalase.length ? (
            <div className="flex gap-[14px] overflow-x-auto pb-2">
              {etalase.map((p) => (
                <ProdukCard
                  key={p.id}
                  name={p.name}
                  shop={p.shop}
                  shopHref={`/lapak/${p.shopSlug}`}
                  price={p.price}
                  oldPrice={p.oldPrice}
                  tone={p.tone}
                  logo={p.logo}
                  cart={keKeranjang(p)}
                  className="min-w-[158px]"
                  ribbon={<Pill variant="gold">Kurasi</Pill>}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
              Etalase sedang ditata kurator.
            </p>
          )}
        </div>
      </section>

      <section className="pb-[34px]">
        <div className="mx-auto max-w-[1080px] px-5">
          <RowHead
            title="Pilihan Untukmu"
            note={pilihanDari === "diikuti" ? "dari lapak yang kamu ikuti" : "paling sering ditebus"}
          />
          {pilihan.length ? (
            <div className="grid grid-cols-2 gap-4">
              {pilihan.map((p) => (
                <ProdukCard
                  key={p.id}
                  name={p.name}
                  shop={p.shop}
                  shopHref={`/lapak/${p.shopSlug}`}
                  price={p.price}
                  oldPrice={p.oldPrice}
                  tone={p.tone}
                  logo={p.logo}
                  cart={keKeranjang(p)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
              Belum ada pilihan. Jelajahi lapak dulu.
            </p>
          )}
          <p className="mt-4 text-center text-[12px] text-kongsi-ink-soft">
            Keliling &amp; isi keranjang tak perlu akun.{" "}
            <Link href="/masuk" className="font-bold text-kongsi-grenadine">
              Masuk
            </Link>{" "}
            hanya saat mau menebus.
          </p>
        </div>
      </section>
    </>
  );
}
