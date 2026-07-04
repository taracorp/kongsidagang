import { CompassRose, WaxSeal } from "@/components/kongsi/icons";
import { Pill, SegelBadge } from "@/components/kongsi/Pill";
import {
  KongsiButton,
  KongsiLinkButton,
} from "@/components/kongsi/KongsiButton";
import { ProdukCard } from "@/components/kongsi/ProdukCard";
import { PintuCard } from "@/components/kongsi/PintuCard";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-8">
      <h3 className="mb-4 font-fraunces text-[22px] font-black text-kongsi-indigo">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function KongsiKit() {
  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8">
      <div className="mb-2 font-fraunces text-[16px] font-semibold italic text-kongsi-grenadine">
        Fase A · Kongsi Kit
      </div>
      <h2 className="font-fraunces text-[32px] font-black text-kongsi-indigo">
        Rangka &amp; komponen dasar
      </h2>

      <Section title="Ikon">
        <div className="flex items-center gap-6">
          <CompassRose size={48} className="text-kongsi-grenadine" />
          <CompassRose size={48} className="text-kongsi-indigo" />
          <WaxSeal size={32} className="text-kongsi-grenadine" />
        </div>
      </Section>

      <Section title="Pill & Segel">
        <div className="flex flex-wrap items-center gap-3">
          <Pill variant="sage">Buka</Pill>
          <Pill variant="gold">Obral Kilat</Pill>
          <Pill variant="live">◉ Lelang · terbuka</Pill>
          <Pill variant="indigo">Vendu = khusus login</Pill>
          <SegelBadge />
          <SegelBadge label="Saudagar Bersegel" />
        </div>
      </Section>

      <Section title="Tombol">
        <div className="flex flex-wrap items-center gap-3">
          <KongsiButton variant="primary">Ikut Lelang</KongsiButton>
          <KongsiButton variant="gold">Isi Pundi</KongsiButton>
          <KongsiButton variant="ghost">Lihat semua</KongsiButton>
          <KongsiLinkButton href="/" variant="primary">
            Ke Beranda
          </KongsiLinkButton>
        </div>
      </Section>

      <Section title="Produk Card">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ProdukCard
            name="Serum Vitamin C 20ml"
            shop="Loji Sari Ayu"
            price={89000}
            oldPrice={120000}
            tone="sage"
            ribbon={<Pill variant="gold">Kurasi</Pill>}
          />
          <ProdukCard
            name="Kain Batik Tulis Sogan"
            shop="Loji Kain Batik"
            price={245000}
            oldPrice={320000}
            tone="beeswax"
          />
          <ProdukCard
            name="Kopi Gayo 200g"
            shop="Loji Kopi Rakyat"
            price={62000}
            oldPrice={80000}
            tone="grenadine"
          />
          <ProdukCard
            name="Madu Hutan 500ml"
            shop="Loji Rempah Timur"
            price={98000}
            oldPrice={130000}
            tone="indigo"
          />
        </div>
      </Section>

      <Section title="Pintu (Loji) Card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PintuCard
            name="Loji Sari Ayu"
            category="Kecantikan & Rempah"
            rating={4.9}
            tone="grenadine"
            sealed
            status={<Pill variant="gold">Obral Kilat</Pill>}
          />
          <PintuCard
            name="Loji Glow Nusantara"
            category="Skincare"
            rating={4.8}
            tone="indigo"
            sealed
            status={<Pill variant="sage">Buka</Pill>}
          />
          <PintuCard
            name="Loji Rempah Timur"
            category="Bumbu & Herbal"
            rating={4.6}
            tone="olive"
            status={<Pill variant="sage">Buka</Pill>}
          />
        </div>
      </Section>
    </div>
  );
}
