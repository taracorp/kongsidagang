import { redirect } from "next/navigation";
import { KongsiLinkButton } from "@/components/kongsi/KongsiButton";
import { PantauBayar } from "@/components/kongsi/PantauBayar";
import { getSessionUser } from "@/lib/auth";
import { rekonsiliasiIsiPundi } from "@/lib/domain/pundi";
import { jalankanTujuan, statusPesanan } from "@/lib/domain/bayar-langsung";
import { formatKeping } from "@/lib/utils";

export const metadata = { title: "Hasil Pembayaran — Kongsi Dagang" };

/** Halaman kembali setelah Bayar Langsung. Tetap benar walau notifikasi DOKU terlambat (cek status + jalankan tujuan). */
export default async function BayarSelesaiPage({ searchParams }: { searchParams: Promise<{ inv?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const { inv } = await searchParams;
  const invoice = String(inv ?? "");
  if (invoice && (await rekonsiliasiIsiPundi(user.id, invoice))) await jalankanTujuan(invoice);
  const o = invoice ? await statusPesanan(user.id, invoice) : null;

  const kartu = "mx-auto max-w-md rounded-[6px] border-2 px-6 py-10 text-center";
  let isi: React.ReactNode;
  if (!o || o.tujuan === "isi") {
    isi = (
      <div className={`${kartu} border-dashed border-kongsi-olive bg-kongsi-parchment-3`}>
        <p className="text-kongsi-ink-soft">Pembayaran tidak ditemukan.</p>
        <KongsiLinkButton href="/pakhuis" variant="gold" className="mt-4">
          Ke Pakhuis
        </KongsiLinkButton>
      </div>
    );
  } else if (o.status === "pending" || (o.status === "paid" && (o.tujuan_status === "menunggu" || o.tujuan_status === "diproses"))) {
    isi = (
      <div className={`${kartu} border-kongsi-ink bg-kongsi-parchment shadow-hard`}>
        <div className="font-fraunces text-xl font-black text-kongsi-indigo">Menunggu pembayaran…</div>
        <p className="mt-2 text-sm text-kongsi-ink-soft">
          {o.status === "paid" ? "Pembayaran diterima, sedang diproses." : `Tagihan ${formatKeping(o.price)}. Halaman ini diperbarui otomatis.`}
        </p>
        <PantauBayar />
      </div>
    );
  } else if (o.status !== "paid") {
    isi = (
      <div className={`${kartu} border-kongsi-grenadine bg-kongsi-parchment-3`}>
        <div className="font-fraunces text-xl font-black text-kongsi-grenadine">
          Pembayaran {o.status === "expired" ? "kedaluwarsa" : "gagal"}
        </div>
        <p className="mt-2 text-sm text-kongsi-ink-soft">Tidak ada uang atau Keteng yang berpindah. Silakan coba lagi.</p>
        <KongsiLinkButton href={o.tujuan === "belanja" ? "/bayar" : "/tukar"} variant="primary" className="mt-4">
          Coba lagi
        </KongsiLinkButton>
      </div>
    );
  } else if (o.tujuan_status === "berhasil") {
    const belanja = o.tujuan === "belanja";
    isi = (
      <div className={`${kartu} border-kongsi-ok bg-kongsi-sage/30`}>
        <div className="font-fraunces text-xl font-black text-kongsi-ok">✓ Pembayaran berhasil</div>
        <p className="mt-2 text-sm text-kongsi-ink-soft">
          {formatKeping(o.price)} masuk sebagai Keteng lalu langsung dipakai. {o.tujuan_hasil}.
          {belanja ? " Tunjukkan kodenya ke petugas di cabang yang kamu pilih." : ""}
        </p>
        {belanja ? <PantauBayar kosongkanKeranjang /> : null}
        <KongsiLinkButton
          href={belanja ? "/pakhuis#surat-jalan" : o.tujuan_ref ? `/tukar/deal/${o.tujuan_ref}` : "/tukar"}
          variant="primary"
          className="mt-4"
        >
          {belanja ? "Lihat Surat Jalan" : "Lihat tukar"}
        </KongsiLinkButton>
      </div>
    );
  } else {
    isi = (
      <div className={`${kartu} border-kongsi-grenadine bg-kongsi-parchment-3`}>
        <div className="font-fraunces text-xl font-black text-kongsi-grenadine">Pembayaran masuk, pesanan belum diproses</div>
        <p className="mt-2 text-sm">{o.tujuan_hasil}</p>
        <p className="mt-2 text-sm text-kongsi-ink-soft">
          {formatKeping(o.price)} sudah jadi Keteng dan aman di Pundi-mu. Coba lagi dengan bayar pakai Keteng.
        </p>
        <KongsiLinkButton href={o.tujuan === "belanja" ? "/keranjang" : "/tukar"} variant="primary" className="mt-4">
          Coba lagi
        </KongsiLinkButton>
      </div>
    );
  }

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[1080px] px-5">
        <div className="mb-[22px] text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">Gerbang Tebus</div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">Hasil pembayaran</h2>
        </div>
        {isi}
      </div>
    </section>
  );
}
