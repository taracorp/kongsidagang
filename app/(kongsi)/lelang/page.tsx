import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { TheatreLelang } from "@/components/kongsi/TheatreLelang";
import { getSessionUser } from "@/lib/auth";
import { getStageAuctions, getMyGuesses, getAdSettings } from "@/lib/queries";

export default async function LelangPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string }>;
}) {
  const { jenis } = await searchParams;
  const isVendu = jenis === "vendu";

  const user = await getSessionUser();

  const auctions = await getStageAuctions(isVendu ? "vendu" : "reguler");
  const [guesses, ad] = await Promise.all([
    getMyGuesses(auctions.map((a) => a.id)),
    getAdSettings(),
  ]);

  return (
    // Reels-style: isi satu layar HP (tanpa scroll). Tinggi pasti = viewport − TopBar − BottomNav.
    <section className="flex h-[calc(100dvh-148px)] min-h-[520px] flex-col px-3 pb-2 pt-2">
      {/* Toggle kompak reguler / khusus */}
      <div className="mb-2 flex justify-center gap-2">
        <KongsiLinkButton href="/lelang" variant={isVendu ? "ghost" : "primary"} className="!px-4 !py-[5px] !text-[12px]">
          Reguler
        </KongsiLinkButton>
        <KongsiLinkButton href="/lelang?jenis=vendu" variant={isVendu ? "primary" : "ghost"} className="!px-4 !py-[5px] !text-[12px]">
          Lelang Khusus
        </KongsiLinkButton>
      </div>

      {isVendu && !user ? (
        <div className="mx-auto mt-8 max-w-md rounded-[6px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-6 py-10 text-center">
          <div className="font-fraunces text-xl font-black text-kongsi-grenadine">🔒 Lelang Khusus — hanya anggota Kongsi</div>
          <p className="mt-2 text-sm text-kongsi-grenadine-dark">Lelang khusus ini hanya untuk yang sudah masuk.</p>
          <KongsiLinkButton href="/masuk" variant="primary" className="mt-4">Masuk</KongsiLinkButton>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <TheatreLelang auctions={auctions} ad={ad} userId={user?.id ?? null} guesses={guesses} />
        </div>
      )}
    </section>
  );
}
