import { prisma } from "@/lib/db";
import { formatKeping } from "@/lib/utils";
import { SelesaikanBermasalah } from "@/components/admin/SelesaikanBermasalah";

const JENIS: Record<string, string> = {
  nominal_tidak_cocok: "Nominal tidak cocok",
  tidak_dikenal: "Invoice tidak dikenal",
  gagal_proses: "Gagal diproses",
};

/**
 * Pembayaran DOKU yang lunas tetapi tidak bisa diproses otomatis (nominal beda, invoice tak dikenal, tujuan gagal).
 * Uang pembeli sudah masuk → wajib ditangani manual (proses atau refund lewat DOKU Back Office), lalu dicatat.
 */
export async function PembayaranBermasalah() {
  const daftar = await prisma.pembayaranBermasalah.findMany({
    where: { selesai_at: null },
    orderBy: { created_at: "desc" },
    take: 30,
  });
  return (
    <div id="pembayaran-bermasalah" className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
      <h3 className="mb-1 font-fraunces text-lg font-black text-kongsi-indigo">Pembayaran bermasalah</h3>
      <p className="mb-3 text-[12px] text-kongsi-ink-soft">
        Uang sudah diterima DOKU tetapi tidak diproses otomatis. Cek di DOKU Back Office, proses atau refund, lalu catat
        tindakannya.
      </p>
      {daftar.length === 0 ? (
        <p className="text-[13px] text-kongsi-ok">✓ Tidak ada yang perlu ditangani.</p>
      ) : (
        <ul className="space-y-3">
          {daftar.map((d) => (
            <li key={d.id} className="rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 p-3 text-[13px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="text-[12px] tracking-[0.5px]">{d.invoice}</b>
                <span className="text-[11px] font-bold uppercase tracking-[1px] text-kongsi-grenadine">{JENIS[d.jenis] ?? d.jenis}</span>
              </div>
              <p className="mt-1">{d.keterangan}</p>
              <p className="mt-1 text-[11px] text-kongsi-ink-soft">
                {d.nominal != null ? `${formatKeping(d.nominal)} · ` : ""}
                {d.created_at.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
              </p>
              <SelesaikanBermasalah id={d.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
