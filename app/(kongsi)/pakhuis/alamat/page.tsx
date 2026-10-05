import Link from "next/link";
import { redirect } from "next/navigation";
import { AlamatForm, HapusAlamat } from "@/components/kongsi/AlamatForm";
import { getSessionUser } from "@/lib/auth";
import { alamatSaya } from "@/lib/domain/alamat";
import { kirimAktif } from "@/lib/shipping/kiriminaja";

export default async function AlamatPage() {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const alamat = await alamatSaya(user.id);
  const aktif = kirimAktif();

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[720px] space-y-5 px-5">
        <div className="text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Pakhuis-ku</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Alamat kirim</h2>
          <p className="mt-1 text-[13px] text-kongsi-ink-soft">
            Dipakai untuk Tukar Guling mode Kirim. Alamat hanya terlihat oleh kurir & lawan tukar setelah sepakat.
          </p>
        </div>

        {alamat.length ? (
          <div className="space-y-2">
            {alamat.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm"
              >
                <div className="text-[13px]">
                  <b className="font-fraunces text-[15px] text-kongsi-indigo">{a.label}</b> · {a.name} · {a.phone}
                  <div>{a.address}</div>
                  <div className="text-kongsi-ink-soft">{a.area}</div>
                </div>
                <HapusAlamat id={a.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment-3 px-4 py-6 text-center text-[13px] text-kongsi-ink-soft">
            Belum ada alamat.
          </p>
        )}

        {aktif ? (
          <AlamatForm />
        ) : (
          <p className="text-center text-[13px] text-kongsi-ink-soft">Mode Kirim belum dibuka.</p>
        )}

        <p className="text-center text-[12px]">
          <Link href="/tukar" className="font-bold text-kongsi-grenadine">
            ← Kembali ke Tukar Guling
          </Link>
        </p>
      </div>
    </section>
  );
}
