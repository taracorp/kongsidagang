import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { Pill } from "@/components/kongsi/Pill";

export default function Beranda() {
  return (
    <div className="mx-auto max-w-[1080px] px-5">
      <header className="py-10 text-center">
        <div className="mb-3 font-fraunces text-[15px] font-semibold italic text-kongsi-olive">
          Anno 1602 — dihidupkan kembali
        </div>
        <h1 className="font-fraunces text-[clamp(42px,8.5vw,80px)] font-black leading-[0.93] text-kongsi-indigo [text-shadow:2px_2px_0_rgba(231,162,74,0.5)]">
          Kongsi <span className="font-medium italic text-kongsi-grenadine">&amp;</span> Dagang
        </h1>
        <p className="mx-auto mt-4 max-w-[540px] text-base text-kongsi-ink-soft">
          Balai lelang, neraca harga, dan loji para saudagar — satu jalur
          perdagangan tempat kamu menawar, menimbang, dan berbelanja.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <KongsiLinkButton href="/kongsi-kit" variant="gold">
            Lihat Kongsi Kit
          </KongsiLinkButton>
          <Pill variant="live">Fase A · rangka siap</Pill>
        </div>
      </header>
      <div className="h-[13px] border-y-2 border-kongsi-ink [background:repeating-linear-gradient(90deg,var(--color-kongsi-grenadine)_0_18px,var(--color-kongsi-beeswax)_18px_36px,var(--color-kongsi-indigo)_36px_54px,var(--color-kongsi-sage)_54px_72px)]" />
    </div>
  );
}
