import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import { CompassRose } from "@/components/kongsi/icons";
import { SegelBadge, Pill } from "@/components/kongsi/Pill";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { ProdukManager } from "@/components/kongsi/ProdukManager";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchants } from "@/lib/queries";

export default async function LapakPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/masuk");

  const merchants = await getMyMerchants(user.id);

  return (
    <div className="min-h-screen bg-kongsi-parchment-3 text-kongsi-ink">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-kongsi-ink bg-kongsi-indigo-dark px-5 py-3">
        <CompassRose size={24} className="text-kongsi-beeswax" />
        <span className="flex-1 font-fraunces text-lg font-black text-kongsi-beeswax">
          Lapak-ku
        </span>
        <Link href="/" className="text-[13px] font-bold text-kongsi-parchment">
          ← Kongsi
        </Link>
        <LogoutButton />
      </header>

      <main className="mx-auto max-w-[1100px] px-5 py-6">
        {merchants.length === 0 ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-6 py-12 text-center">
            <h2 className="font-fraunces text-xl font-black text-kongsi-indigo">
              Kamu belum punya lapak
            </h2>
            <p className="mt-2 text-sm text-kongsi-ink-soft">
              Ajukan jadi Saudagar; setelah disetujui pengurus, lojimu muncul di
              sini.
            </p>
            <KongsiLinkButton href="/saudagar/daftar" variant="primary" className="mt-4">
              Ajukan Jadi Saudagar
            </KongsiLinkButton>
          </div>
        ) : (
          <div className="space-y-8">
            {merchants.map((m) => (
              <section key={m.id}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="font-fraunces text-2xl font-black text-kongsi-indigo">
                    {m.name}
                  </h2>
                  {m.is_sealed ? <SegelBadge /> : null}
                  <Pill variant={m.status === "obral" ? "gold" : "sage"}>
                    {m.status}
                  </Pill>
                  <Link
                    href={`/loji/${m.slug}`}
                    className="ml-auto text-[13px] font-bold text-kongsi-grenadine"
                  >
                    Lihat lapak publik →
                  </Link>
                </div>
                <ProdukManager merchantId={m.id} products={m.products} />
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
