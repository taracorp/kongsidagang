import Link from "next/link";
import { redirect } from "next/navigation";
import { RekeningForm } from "@/components/kongsi/RekeningForm";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Rekening Pencairan — Kongsi Dagang" };

/** Rekening untuk menerima selisih Tukar Guling / pengembalian dana. */
export default async function RekeningPage() {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const r = await prisma.rekeningUser.findUnique({ where: { user_id: user.id } });

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[560px] space-y-5 px-5">
        <div className="text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Pakhuis-ku</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Rekening pencairan</h2>
          <p className="mt-1 text-[13px] text-kongsi-ink-soft">
            Untuk menerima selisih Tukar Guling dan pengembalian dana. Hanya dilihat pengurus Kongsi saat mentransfer.
            Pastikan nama sesuai buku tabungan.
          </p>
        </div>
        <RekeningForm awal={r ? { bank: r.bank, nomor: r.nomor, atas_nama: r.atas_nama } : null} />
        <p className="text-center text-[12px]">
          <Link href="/pakhuis#transfer" className="font-bold text-kongsi-grenadine">
            ← Kembali ke Pakhuis
          </Link>
        </p>
      </div>
    </section>
  );
}
