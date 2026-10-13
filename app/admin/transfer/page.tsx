import Link from "next/link";
import { redirect } from "next/navigation";
import { TandaiTransfer } from "@/components/admin/TandaiTransfer";
import { namaBank } from "@/lib/data/bank";
import { daftarTransferAdmin, LABEL_TRANSFER, type BarisTransfer, type JenisTransfer } from "@/lib/domain/transfer";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { cn, formatKeping } from "@/lib/utils";

const tgl = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Rekening({ t }: { t: BarisTransfer }) {
  if (!t.rekening) return <span className="font-bold text-kongsi-bad">Belum mengisi rekening</span>;
  return (
    <span>
      <b>{namaBank(t.rekening.bank)}</b> {t.rekening.nomor}
      <br />
      a.n. {t.rekening.atas_nama}
    </span>
  );
}

/** Kantor Kongsi: antrian uang keluar (pencairan/pengembalian selisih, nanti setoran lapak & klaim) — transfer manual. */
export default async function AdminTransfer() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const { antri, riwayat } = await daftarTransferAdmin();
  const total = antri.reduce((s, t) => s + t.nominal, 0);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-kongsi-ink-soft">
        Uang keluar hanya dari dana yang sudah diterima untuk transaksi itu. Transfer dari rekening Kongsi sesuai nominal
        (biaya transfer sudah ditagih dari pihak yang tepat), lalu tandai dengan nomor referensi bank. Urut tenggat;
        merah = lewat tenggat.
      </p>
      <h3 className="font-fraunces text-lg font-black text-kongsi-indigo">
        Antrian ({antri.length}) · {formatKeping(total)}
      </h3>
      {antri.length === 0 ? (
        <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
          Tidak ada transfer yang menunggu.
        </p>
      ) : (
        <div className="space-y-3">
          {antri.map((t) => {
            const telat = t.lewatTenggat;
            return (
              <div
                key={t.id}
                className={cn(
                  "grid gap-3 rounded-[6px] border-2 bg-kongsi-parchment p-4 text-[13px] shadow-hard-sm md:grid-cols-[1fr_1fr_260px]",
                  telat ? "border-kongsi-bad" : "border-kongsi-ink",
                )}
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[1px] text-kongsi-olive">{LABEL_TRANSFER[t.jenis as JenisTransfer] ?? t.jenis}</div>
                  <div className="font-fraunces text-2xl font-black text-kongsi-indigo">{formatKeping(t.nominal)}</div>
                  <div className={telat ? "font-bold text-kongsi-bad" : "text-kongsi-ink-soft"}>Tenggat {tgl(t.tenggat)}</div>
                  <div className="mt-1">{t.keterangan}</div>
                  {t.dealId ? (
                    <Link href={`/tukar/deal/${t.dealId}`} className="text-[12px] font-bold text-kongsi-grenadine">
                      Lihat tukar ↗
                    </Link>
                  ) : null}
                </div>
                <div>
                  <div className="font-bold">{t.penerima.name}</div>
                  <div className="text-kongsi-ink-soft">{t.penerima.email}</div>
                  <div className="mt-2">
                    <Rekening t={t} />
                  </div>
                  <div className="mt-1 text-[11px] text-kongsi-ink-soft">Biaya transfer (sudah ditagih): {formatKeping(t.biaya)}</div>
                </div>
                <TandaiTransfer id={t.id} nominal={t.nominal} siap={Boolean(t.rekening)} />
              </div>
            );
          })}
        </div>
      )}

      <h3 className="pt-2 font-fraunces text-lg font-black text-kongsi-indigo">Riwayat terakhir</h3>
      {riwayat.length === 0 ? (
        <p className="text-[13px] text-kongsi-ink-soft">Belum ada.</p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
          <table className="w-full border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
                <th className="p-2">Dibayar</th>
                <th className="p-2">Jenis</th>
                <th className="p-2">Penerima</th>
                <th className="p-2">Rekening</th>
                <th className="p-2">Nominal</th>
                <th className="p-2">Ref</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((t) => (
                <tr key={t.id} className="even:bg-kongsi-sage/10">
                  <td className="border-t border-kongsi-ink/15 p-2">{t.dibayarAt ? tgl(t.dibayarAt) : t.status}</td>
                  <td className="border-t border-kongsi-ink/15 p-2">{LABEL_TRANSFER[t.jenis as JenisTransfer] ?? t.jenis}</td>
                  <td className="border-t border-kongsi-ink/15 p-2">{t.penerima.name}</td>
                  <td className="border-t border-kongsi-ink/15 p-2">
                    <Rekening t={t} />
                  </td>
                  <td className="border-t border-kongsi-ink/15 p-2 font-bold">{formatKeping(t.nominal)}</td>
                  <td className="border-t border-kongsi-ink/15 p-2">{t.referensi ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
