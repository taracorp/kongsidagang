import Link from "next/link";
import { prisma } from "@/lib/db";
import { ringkasanLapak } from "@/lib/domain/setoran";
import { formatKeping } from "@/lib/utils";

/**
 * Ringkasan uang belanja e-voucher (dibayar uang lewat DOKU):
 * - titipan lapak = harga voucher, milik lapak; disetor hanya bila ditebus ≥ 3 hari tanpa laporan / kedaluwarsa;
 * - platform fee = pendapatan Kongsi; biaya pembayaran = untuk potongan DOKU (bukan pendapatan);
 * - potongan = biaya pengembalian akibat kesalahan lapak, dikurangkan dari setoran berikutnya.
 */
export async function TitipanLapak() {
  const [agg, lapak] = await Promise.all([
    prisma.order.aggregate({ where: { status: "lunas", provider: { not: null } }, _sum: { bea: true, total: true }, _count: true }),
    ringkasanLapak(),
  ]);
  const jumlah = (k: "aktif" | "ditahan" | "siapSetor" | "antriSetor" | "sudahDisetor" | "potongan") => lapak.reduce((t, m) => t + m[k], 0);
  const baris = "flex justify-between gap-3 border-b-[1.5px] border-dashed border-kongsi-ink/20 py-[6px] text-[13px] last:border-b-0";

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
      <h3 className="mb-1 font-fraunces text-lg font-black text-kongsi-indigo">Titipan lapak & pendapatan</h3>
      <p className="mb-3 text-[12px] text-kongsi-ink-soft">
        {agg._count} pesanan lunas · diterima {formatKeping(agg._sum.total ?? 0)}. Platform fee:{" "}
        <b className="text-kongsi-ok">{formatKeping(agg._sum.bea ?? 0)}</b>.
      </p>
      <div className={baris}>
        <span>Voucher aktif (belum boleh disetor)</span>
        <span>{formatKeping(jumlah("aktif"))}</span>
      </div>
      <div className={baris}>
        <span>Ditebus &lt; 3 hari / ada laporan</span>
        <span>{formatKeping(jumlah("ditahan"))}</span>
      </div>
      <div className={baris}>
        <span className="font-bold">Siap setor</span>
        <b>{formatKeping(jumlah("siapSetor"))}</b>
      </div>
      <div className={baris}>
        <span>Potongan belum tertutup</span>
        <span className="text-kongsi-bad">{formatKeping(jumlah("potongan"))}</span>
      </div>
      <div className={baris}>
        <span>Setoran antri / sudah disetor</span>
        <span>
          {formatKeping(jumlah("antriSetor"))} / {formatKeping(jumlah("sudahDisetor"))}
        </span>
      </div>
      <Link href="/admin/setoran" className="mt-3 inline-block text-[13px] font-bold text-kongsi-grenadine">
        Kelola setoran & laporan →
      </Link>
    </div>
  );
}
