import Link from "next/link";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { getSessionUser } from "@/lib/auth";
import { kabarSaya, tandaiDibaca } from "@/lib/domain/kabar-user";
import { cn } from "@/lib/utils";

const IKON: Record<string, string> = {
  tukar: "⇄",
  pundi: "💰",
  voucher: "🎟️",
  tera: "⚖️",
  lelang: "🔨",
  sistem: "📣",
};

function waktu(iso: string) {
  const d = new Date(iso);
  const menit = Math.round((Date.now() - d.getTime()) / 60_000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit lalu`;
  if (menit < 24 * 60) return `${Math.round(menit / 60)} jam lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function KabarSayaPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <section className="py-[34px]">
        <div className="mx-auto max-w-md px-5 text-center">
          <h2 className="font-fraunces text-[28px] font-black text-kongsi-indigo">Kabar untukmu</h2>
          <p className="mt-2 text-[13px] text-kongsi-ink-soft">
            Masuk untuk melihat kabar tawaran tukar, Surat Jalan, dan pembayaranmu.
          </p>
          <KongsiLinkButton href="/masuk" variant="primary" className="mt-4">
            Masuk
          </KongsiLinkButton>
          <p className="mt-4 text-[12px]">
            <Link href="/kabar" className="font-bold text-kongsi-grenadine">
              Baca artikel Kabar Kongsi →
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const daftar = await kabarSaya(user.id);
  // Halaman sudah dibuka → semua dianggap terbaca (tampilan tetap menandai yang tadinya baru).
  if (daftar.some((k) => !k.read)) await tandaiDibaca(user.id);

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[720px] px-5">
        <div className="mb-5 text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Lonceng Kongsi</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Kabar untukmu</h2>
        </div>
        {daftar.length === 0 ? (
          <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-10 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada kabar. Kabar tawaran tukar, Surat Jalan, dan pembayaran akan muncul di sini.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard">
            {daftar.map((k) => {
              const isi = (
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[4px] border-2 border-kongsi-ink bg-kongsi-parchment-3 text-[16px]">
                    {IKON[k.kind] ?? "📣"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <b className="text-[14px] text-kongsi-indigo">{k.title}</b>
                      {!k.read ? (
                        <span className="mt-[3px] h-[10px] w-[10px] flex-none rounded-full border-[1.5px] border-kongsi-ink bg-kongsi-grenadine" aria-label="baru" />
                      ) : null}
                    </div>
                    {k.body ? <div className="text-[13px] text-kongsi-ink-soft">{k.body}</div> : null}
                    <div className="mt-[2px] text-[11px] text-kongsi-olive">{waktu(k.created_at)}</div>
                  </div>
                </div>
              );
              return (
                <li key={k.id} className={cn("border-b-[1.5px] border-kongsi-ink/10 last:border-b-0", !k.read && "bg-kongsi-beeswax/15")}>
                  {k.href ? (
                    <Link href={k.href} className="block px-4 py-3 hover:bg-kongsi-sage/20">
                      {isi}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{isi}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
