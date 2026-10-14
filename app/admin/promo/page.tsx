import { redirect } from "next/navigation";
import { PromoManager } from "@/components/kongsi/PromoForm";
import { buatDiskonPlatform, aturDiskonPlatformAktif } from "@/app/actions/admin";
import { daftarDiskonPlatform } from "@/lib/domain/diskon";
import { getStaffSession, isAdminUp } from "@/lib/roles";

/** Promo Kongsi — ditanggung Kongsi (dari platform fee), wajib beranggaran. */
export default async function AdminPromo() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const daftar = await daftarDiskonPlatform();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-fraunces text-xl font-black text-kongsi-indigo">Promo Kongsi</h2>
        <p className="text-[13px] text-kongsi-ink-soft">
          Diskon yang ditanggung Kongsi (biaya pemasaran). Wajib punya anggaran — promo berhenti otomatis saat anggaran atau
          kuota habis, jadi Kongsi tidak pernah rugi di luar anggaran. Berlaku untuk belanja e-voucher (bukan lelang/Tukar
          Guling). Pembeli bisa memakai 1 promo Kongsi + 1 promo lapak per pesanan.
        </p>
      </div>
      <PromoManager pembuat="platform" daftar={daftar} simpan={buatDiskonPlatform} aturAktif={aturDiskonPlatformAktif} />
    </div>
  );
}
