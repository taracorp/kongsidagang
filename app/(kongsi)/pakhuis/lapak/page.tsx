import Link from "next/link";
import { redirect } from "next/navigation";
import { SegelBadge, Pill } from "@/components/kongsi/Pill";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { ProfilLapak, CabangManager, ProdukManager, ValidasiVoucher } from "@/components/kongsi/KelolaLapak";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { getLapakKelola, getRiwayatTebus } from "@/lib/queries-lapak";

export default async function KelolaLapakPage() {
  const s = await getStaffSession();
  if (!s.userId) redirect("/masuk");
  const lapak = await getLapakKelola(s.userId, isAdminUp(s.role));
  const riwayat = new Map(await Promise.all(lapak.map(async (m) => [m.id, await getRiwayatTebus(m.id, 10)] as const)));

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] space-y-6 px-5">
        <div>
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Pakhuis-ku</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Kelola Lapak</h2>
        </div>

        {lapak.length === 0 ? (
          <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-6 py-12 text-center">
            <h3 className="font-fraunces text-xl font-black text-kongsi-indigo">Kamu belum punya lapak</h3>
            <p className="mt-2 text-sm text-kongsi-ink-soft">
              Ajukan jadi Saudagar; setelah disetujui pengurus, lapakmu muncul di sini.
            </p>
            <KongsiLinkButton href="/saudagar/daftar" variant="primary" className="mt-4">
              Ajukan Jadi Saudagar
            </KongsiLinkButton>
          </div>
        ) : (
          lapak.map((m) => (
            <div key={m.id} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-fraunces text-2xl font-black text-kongsi-indigo">{m.name}</h3>
                <SegelBadge />
                <Pill variant={m.status === "buka" ? "sage" : m.status === "segera" ? "indigo" : "gold"}>{m.status}</Pill>
                <Link href={`/lapak/${m.slug}`} className="ml-auto text-[13px] font-bold text-kongsi-grenadine">
                  Lihat lapak publik →
                </Link>
              </div>

              <ValidasiVoucher m={m} />

              {riwayat.get(m.id)?.length ? (
                <details className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 text-[13px] shadow-hard-sm">
                  <summary className="cursor-pointer font-fraunces text-lg font-black text-kongsi-indigo">
                    Riwayat tebus terakhir
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {riwayat.get(m.id)!.map((r) => (
                      <li key={r.code ?? r.at} className="flex flex-wrap justify-between gap-2 border-b-[1.5px] border-kongsi-ink/10 py-1">
                        <span>
                          {r.title} · <span className="text-kongsi-ink-soft">{r.pembeli}{r.cabang ? ` · ${r.cabang}` : ""}</span>
                        </span>
                        <span className="text-kongsi-ink-soft">{r.at ? new Date(r.at).toLocaleString("id-ID") : ""}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <ProfilLapak m={m} />
              <CabangManager m={m} />
              <ProdukManager m={m} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
