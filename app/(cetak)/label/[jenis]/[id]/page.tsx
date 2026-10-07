import { notFound, redirect } from "next/navigation";
import { LabelPengiriman, type DataLabel, type PihakLabel } from "@/components/label/LabelPengiriman";
import { TombolCetak } from "@/components/label/TombolCetak";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStaffSession, isAdminUp } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Label Pengiriman — Kongsi Dagang" };

const kota = (area?: string) => (area ?? "").split(",").map((x) => x.trim())[2] ?? "";

/** Label pengiriman: /label/uji/[id] (paket uji admin) atau /label/tukar/[shipmentId] (pengirim paket / admin). */
export default async function LabelPage({ params }: { params: Promise<{ jenis: string; id: string }> }) {
  const { jenis, id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const { role } = await getStaffSession();
  const admin = isAdminUp(role);
  let d: DataLabel | null = null;

  if (jenis === "uji") {
    if (!admin) notFound();
    const u = await prisma.kurirUji.findUnique({ where: { id } });
    if (!u) notFound();
    d = {
      order_id: u.order_id,
      awb: u.awb,
      sorting_code: u.sorting_code,
      courier: u.courier,
      service_name: u.service_name,
      service_type: u.service_type,
      cod: 0,
      insurance: u.insurance,
      item_value: u.item_value,
      weight_g: u.weight_g,
      qty: u.qty,
      items: [{ name: u.item_name, qty: u.qty, price: Math.round(u.item_value / u.qty) }],
      pengirim: u.pengirim as unknown as PihakLabel,
      penerima: u.penerima as unknown as PihakLabel,
      dibuat: u.created_at,
      catatan: u.skenario,
    };
  } else if (jenis === "tukar") {
    const s = await prisma.barterShipment.findUnique({
      where: { id },
      include: { deal: { include: { itemA: { select: { user_id: true, title: true } }, itemB: { select: { user_id: true, title: true } } } } },
    });
    if (!s || !s.order_id) notFound();
    const pengirimItem = s.leg === "a_to_b" ? s.deal.itemA : s.deal.itemB;
    if (!admin && pengirimItem.user_id !== user.id) notFound();
    const o = s.origin as unknown as PihakLabel & { area: string };
    const t = s.destination as unknown as PihakLabel & { area: string };
    d = {
      order_id: s.order_id,
      awb: s.awb,
      sorting_code: s.sorting_code,
      courier: s.courier,
      service_name: s.service_name,
      service_type: s.service_type,
      cod: 0,
      insurance: s.insurance,
      item_value: s.item_value,
      weight_g: s.weight_g,
      qty: 1,
      items: [{ name: pengirimItem.title, qty: 1, price: s.item_value }],
      pengirim: { ...o, city: kota(o.area) },
      penerima: { ...t, city: kota(t.area) },
      dibuat: s.created_at,
      catatan: "Tukar Guling",
    };
  }
  if (!d) notFound();

  return (
    <main className="min-h-screen bg-kongsi-parchment-3 py-6 print:bg-white print:py-0">
      <style>{`@page { size: 100mm 150mm; margin: 0 } @media print { .cetak-sembunyi { display: none !important } body { background: white } }`}</style>
      <div className="cetak-sembunyi mx-auto mb-4 flex w-[100mm] items-center justify-between">
        <span className="font-fraunces text-[15px] font-black text-kongsi-indigo">Label pengiriman</span>
        <TombolCetak />
      </div>
      <LabelPengiriman d={d} />
    </main>
  );
}
