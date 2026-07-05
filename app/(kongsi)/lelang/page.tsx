import { Pill } from "@/components/kongsi/Pill";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { LelangLive } from "@/components/kongsi/LelangLive";
import { createClient } from "@/lib/supabase/server";
import { getActiveAuction, getMyGuess } from "@/lib/queries";

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

  const auction = await getActiveAuction(isVendu ? "vendu" : "reguler");
  const myGuess = auction ? await getMyGuess(auction.id) : null;

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
        ) : auction ? (
          <LelangLive auction={auction} userId={user?.id ?? null} initialGuess={myGuess} />
        ) : (
          <div className="mx-auto mt-8 max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-6 py-12 text-center">
            <Pill variant="gold">Slot Iklan / Video</Pill>
            <p className="mt-3 text-sm text-kongsi-ink-soft">
              Belum ada lelang berjalan. Pantau Beranda untuk jadwal berikutnya.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
