import { redirect } from "next/navigation";
import { BuatSetoran, KembalikanVoucher, PutusKomplain } from "@/components/admin/SetoranAksi";
import { daftarKomplain, ringkasanLapak, HARI_TAHAN_SETOR } from "@/lib/domain/setoran";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { formatKeping } from "@/lib/utils";

const sel = "border-t border-kongsi-ink/15 p-2";

/** Kantor Kongsi: titipan lapak, setoran, laporan pembeli, dan pengembalian voucher. */
export default async function AdminSetoran() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const [lapak, komplain] = await Promise.all([ringkasanLapak(), daftarKomplain()]);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-kongsi-ink-soft">
        Titipan lapak hanya disetor untuk voucher yang <b>ditebus ≥ {HARI_TAHAN_SETOR} hari tanpa laporan</b> atau{" "}
        <b>kedaluwarsa</b>. Potongan (pengembalian akibat kesalahan lapak) dikurangkan otomatis. &ldquo;Buat setoran&rdquo; memasukkan
        transfer ke antrian <a href="/admin/transfer" className="font-bold text-kongsi-grenadine">Transfer Keluar</a>.
      </p>

      <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">Titipan per lapak</h3>
      {lapak.length === 0 ? (
        <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
          Belum ada penjualan voucher.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
          <table className="w-full border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
                <th className="p-2">Lapak</th>
                <th className="p-2">Aktif</th>
                <th className="p-2">Ditahan</th>
                <th className="p-2">Siap setor</th>
                <th className="p-2">Potongan</th>
                <th className="p-2">Antri / disetor</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {lapak.map((m) => (
                <tr key={m.merchantId} className="even:bg-kongsi-sage/10">
                  <td className={sel}>
                    <b>{m.nama}</b>
                    <div className={m.rekening ? "text-kongsi-ink-soft" : "font-bold text-kongsi-bad"}>{m.rekening ?? "Rekening belum diisi"}</div>
                  </td>
                  <td className={sel}>{formatKeping(m.aktif)}</td>
                  <td className={sel}>{formatKeping(m.ditahan)}</td>
                  <td className={sel}>
                    <b>{formatKeping(m.siapSetor)}</b> <span className="text-kongsi-ink-soft">({m.siapJumlah})</span>
                  </td>
                  <td className={sel}>{m.potongan ? <span className="text-kongsi-bad">−{formatKeping(m.potongan)}</span> : "—"}</td>
                  <td className={sel}>
                    {formatKeping(m.antriSetor)} / {formatKeping(m.sudahDisetor)}
                  </td>
                  <td className={sel}>
                    <BuatSetoran merchantId={m.merchantId} nominal={m.siapSetor - m.potongan} siap={Boolean(m.rekening) && m.siapSetor > m.potongan} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="pt-2 font-fraunces text-lg font-black text-kongsi-indigo">Laporan pembeli ({komplain.length})</h3>
      {komplain.length === 0 ? (
        <p className="text-[13px] text-kongsi-ink-soft">Tidak ada laporan terbuka.</p>
      ) : (
        <div className="space-y-3">
          {komplain.map((k) => (
            <div key={k.id} className="grid gap-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 text-[13px] shadow-hard-sm md:grid-cols-[1fr_280px]">
              <div>
                <b className="font-fraunces text-base text-kongsi-indigo">{k.voucher?.title}</b> · {k.voucher?.merchant?.name}
                {k.voucher?.branch ? ` · ${k.voucher.branch.name}` : ""}
                <div className="text-kongsi-ink-soft">
                  {k.voucher?.user.name || k.voucher?.user.email} · {k.voucher?.code} · {formatKeping(k.voucher?.orderItem?.unit_price ?? 0)} ·{" "}
                  {k.voucher?.status === "terpakai" ? `ditebus ${k.voucher.redeemed_at?.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}` : k.voucher?.status}
                </div>
                <p className="mt-2 rounded-[4px] bg-kongsi-parchment-3 p-2">{k.alasan}</p>
              </div>
              <PutusKomplain id={k.id} />
            </div>
          ))}
        </div>
      )}

      <h3 className="pt-2 font-fraunces text-lg font-black text-kongsi-indigo">Kembalikan voucher aktif</h3>
      <p className="text-[13px] text-kongsi-ink-soft">
        Untuk cabang yang tutup permanen atau lapak yang menolak voucher sah. Pembeli kembali utuh lewat transfer; platform
        fee, biaya pembayaran, dan biaya transfer menjadi potongan setoran lapak.
      </p>
      <KembalikanVoucher />
    </div>
  );
}
