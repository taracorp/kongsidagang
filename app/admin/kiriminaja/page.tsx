import { redirect } from "next/navigation";
import { UjiKurir } from "@/components/admin/UjiKurir";
import { beratVolume, daftarPaketUji, infoKoneksi, logWebhook } from "@/lib/domain/kurir-uji";
import { getStaffSession, isAdminUp } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function AdminUjiKurir() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const [paket, log] = await Promise.all([daftarPaketUji(), logWebhook()]);
  return (
    <UjiKurir
      info={infoKoneksi()}
      paket={paket.map((p) => ({
        id: p.id,
        order_id: p.order_id,
        awb: p.awb,
        sorting_code: p.sorting_code,
        pickup_number: p.pickup_number,
        courier: p.courier,
        service_name: p.service_name,
        skenario: p.skenario,
        weight_g: p.weight_g,
        volume_g: beratVolume(p),
        insurance: p.insurance,
        shipping_cost: p.shipping_cost,
        status: p.status,
        status_text: p.status_text,
        created_at: p.created_at.toISOString(),
      }))}
      log={log.map((g) => ({
        id: g.id,
        method: g.method,
        payload: JSON.stringify(g.payload, null, 2),
        diproses: g.diproses,
        created_at: g.created_at.toISOString(),
      }))}
    />
  );
}
