import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BayarLelangForm } from "@/components/kongsi/BayarLelangForm";
import { HitungMundur } from "@/components/kongsi/DealTukar";
import { getSessionUser } from "@/lib/auth";
import { dataBayarLelang } from "@/lib/domain/lelang";
import { platformFee } from "@/lib/payment/biaya";
import { sudahPkp } from "@/lib/domain/belanja";
import { formatKeping } from "@/lib/utils";

export const metadata = { title: "Bayar Lelang — Kongsi Dagang" };

/** Pemenang lelang membayar harga set + platform fee + biaya DOKU; Surat Jalan terbit setelah lunas. */
export default async function BayarLelangPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const d = await dataBayarLelang(user.id, id);
  if (!d) notFound();
  const fee = platformFee(sudahPkp()).total;
  const kartu = "rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard";

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[560px] space-y-5 px-5">
        <div className="text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Balai Lelang</div>
          <h2 className="mt-1 font-fraunces text-[28px] font-black text-kongsi-indigo">{d.produk}</h2>
          <p className="text-[13px] text-kongsi-ink-soft">
            {d.lapak} · berlaku {d.masaBerlaku} hari setelah dibayar
          </p>
        </div>
        <div className={kartu}>
          {d.status === "menunggu" ? (
            <>
              <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">
                Kamu pemegang hak beli{d.peringkat > 1 ? ` (peringkat ${d.peringkat})` : ""}
              </h3>
              {d.tenggat ? (
                <div className="my-2 font-fraunces text-xl font-black text-kongsi-grenadine">
                  <HitungMundur until={d.tenggat} />
                </div>
              ) : null}
              <div className="my-3 space-y-1 text-[14px]">
                <div className="flex justify-between">
                  <span>Harga lelang</span>
                  <b>{formatKeping(d.harga)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee</span>
                  <span>{formatKeping(fee)}</span>
                </div>
              </div>
              <BayarLelangForm auctionId={id} cabang={d.cabang} neto={d.harga + fee} />
              <p className="mt-3 text-[12px] text-kongsi-ink-soft">
                Lewat batas waktu → hak beli pindah ke peringkat berikutnya. Pembayaran yang masuk setelah hak berpindah
                dikembalikan dipotong biaya pembayaran &amp; transfer.
              </p>
            </>
          ) : d.status === "lunas" ? (
            <p className="font-bold text-kongsi-ok">
              ✓ Lunas. Surat Jalan ada di{" "}
              <Link href="/pakhuis#surat-jalan" className="underline">
                Pakhuis
              </Link>
              .
            </p>
          ) : d.status === "hangus" ? (
            <p className="text-kongsi-bad">Hak beli hangus karena tidak dibayar sebelum batas waktu.</p>
          ) : (
            <p className="text-kongsi-ink-soft">Kamu di peringkat {d.peringkat}. Hak beli pindah ke kamu bila peringkat di atasmu tidak membayar.</p>
          )}
        </div>
      </div>
    </section>
  );
}
