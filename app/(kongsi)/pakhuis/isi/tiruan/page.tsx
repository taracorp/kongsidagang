import { notFound, redirect } from "next/navigation";
import { BayarTiruan } from "@/components/kongsi/PundiActions";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatKeping } from "@/lib/utils";
import { tautanHasil } from "@/lib/domain/bayar-langsung";

/** Halaman bayar tiruan pengganti DOKU (hanya DOKU_MOCK=true, untuk dev/uji). */
export default async function BayarTiruanPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  if (process.env.DOKU_MOCK !== "true") notFound();
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const { invoice } = await searchParams;
  const belanja = invoice
    ? await prisma.order.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } })
    : null;
  const t = invoice && !belanja
    ? await prisma.topupOrder.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } })
    : null;
  if (!belanja && !t) notFound();
  const o = belanja
    ? { invoice_number: belanja.invoice_number!, price: belanja.total, status: belanja.status, info: `E-voucher · metode ${belanja.metode}` }
    : { invoice_number: t!.invoice_number, price: t!.price, status: t!.status, info: `${t!.keteng.toLocaleString("id-ID")} Keteng · metode ${t!.metode ?? "-"}` };
  const kembali = belanja || t!.tujuan !== "isi" ? tautanHasil(o.invoice_number) : `/pakhuis?isi=${encodeURIComponent(o.invoice_number)}`;

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[480px] px-5">
        <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 text-center shadow-hard">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">Simulasi DOKU (dev)</div>
          <h2 className="mt-1 font-fraunces text-[26px] font-black text-kongsi-indigo">{formatKeping(o.price)}</h2>
          <p className="mb-4 text-[13px] text-kongsi-ink-soft">
            Invoice {o.invoice_number} · {o.info} · status {o.status}
          </p>
          <BayarTiruan invoice={o.invoice_number} kembali={kembali} />
        </div>
      </div>
    </section>
  );
}
