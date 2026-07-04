import { Pill } from "@/components/kongsi/Pill";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { BalaiLelang } from "@/components/kongsi/BalaiLelang";
import { createClient } from "@/lib/supabase/server";

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
            <Pill variant={isVendu ? "sage" : "live"}>
              ◉ Lelang Reguler · terbuka
            </Pill>
            <Pill variant={isVendu ? "indigo" : "indigo"}>
              Vendu = khusus login
            </Pill>
          </div>
        </div>

        {isVendu && !user ? (
          <div className="mx-auto mt-8 max-w-md rounded-[6px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-6 py-10 text-center">
            <div className="font-fraunces text-xl font-black text-kongsi-grenadine">
              🔒 Vendu khusus anggota loji
            </div>
            <p className="mt-2 text-sm text-kongsi-grenadine-dark">
              Lelang khusus (Vendu) hanya untuk yang sudah masuk loji. Masuk dulu
              untuk ikut.
            </p>
            <KongsiLinkButton href="/masuk" variant="primary" className="mt-4">
              Masuk Loji
            </KongsiLinkButton>
          </div>
        ) : (
          <BalaiLelang />
        )}
      </div>
    </section>
  );
}
