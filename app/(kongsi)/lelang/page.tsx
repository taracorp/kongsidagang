import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { TheatreLelang } from "@/components/kongsi/TheatreLelang";
import { createClient } from "@/lib/supabase/server";
import { getStageAuctions, getMyGuesses, getAdSettings } from "@/lib/queries";

export default async function LelangPage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string }>;
}) {
  const { jenis } = await searchParams;
  const isVendu = jenis === "vendu";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const auctions = await getStageAuctions(isVendu ? "vendu" : "reguler");
  const [guesses, ad] = await Promise.all([
    getMyGuesses(auctions.map((a) => a.id)),
    getAdSettings(),
  ]);

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Balai Lelang
          </div>
          <h2 className="mt-1 font-fraunces text-[32px] font-black text-kongsi-indigo">
            Tebak harga, menangi barang
          </h2>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <KongsiLinkButton
              href="/lelang"
              variant={isVendu ? "ghost" : "primary"}
              className="!px-4 !py-[6px] !text-[13px]"
            >
              Lelang Reguler
            </KongsiLinkButton>
            <KongsiLinkButton
              href="/lelang?jenis=vendu"
              variant={isVendu ? "primary" : "ghost"}
              className="!px-4 !py-[6px] !text-[13px]"
            >
              Vendu (khusus login)
            </KongsiLinkButton>
          </div>
        </div>

        {isVendu && !user ? (
          <div className="mx-auto mt-8 max-w-md rounded-[6px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-6 py-10 text-center">
            <div className="font-fraunces text-xl font-black text-kongsi-grenadine">
              🔒 Vendu khusus anggota loji
            </div>
            <p className="mt-2 text-sm text-kongsi-grenadine-dark">
              Lelang khusus (Vendu) hanya untuk yang sudah masuk loji.
            </p>
            <KongsiLinkButton href="/masuk" variant="primary" className="mt-4">
              Masuk Loji
            </KongsiLinkButton>
          </div>
        ) : (
          <TheatreLelang
            auctions={auctions}
            ad={ad}
            userId={user?.id ?? null}
            guesses={guesses}
          />
        )}
      </div>
    </section>
  );
}
