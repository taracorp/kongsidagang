import { notFound, redirect } from "next/navigation";
import { BayarTiruan } from "@/components/kongsi/PundiActions";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatKeping } from "@/lib/utils";

/** Halaman bayar tiruan pengganti DOKU (hanya DOKU_MOCK=true, untuk dev/uji). */
export default async function BayarTiruanPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  if (process.env.DOKU_MOCK !== "true") notFound();
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const { invoice } = await searchParams;
  const o = invoice
    ? await prisma.topupOrder.findFirst({ where: { invoice_number: String(invoice), user_id: user.id } })
    : null;
  if (!o) notFound();

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[480px] px-5">
        <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 text-center shadow-hard">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">Simulasi DOKU (dev)</div>
          <h2 className="mt-1 font-fraunces text-[26px] font-black text-kongsi-indigo">{formatKeping(o.price)}</h2>
          <p className="mb-4 text-[13px] text-kongsi-ink-soft">
            Invoice {o.invoice_number} · {o.keteng.toLocaleString("id-ID")} Keteng · status {o.status}
          </p>
          <BayarTiruan invoice={o.invoice_number} />
        </div>
      </div>
    </section>
  );
}
