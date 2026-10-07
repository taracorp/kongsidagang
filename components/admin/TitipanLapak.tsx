import { prisma } from "@/lib/db";
import { formatKeping } from "@/lib/utils";

/**
 * Ringkasan uang belanja e-voucher yang sudah lunas (dibayar uang lewat DOKU):
 * - titipan lapak = harga voucher, milik lapak, wajib disetor ke lapak;
 * - platform fee = pendapatan Kongsi (omzet Kongsi sebagai perantara);
 * - biaya pembayaran = dibayar pembeli untuk menutup potongan DOKU (bukan pendapatan).
 * Pesanan lama yang dibayar Keteng (provider null) tidak dihitung.
 */
export async function TitipanLapak() {
  const [items, agg] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { status: "lunas", provider: { not: null } } },
      select: { unit_price: true, qty: true, merchant: { select: { name: true } } },
    }),
    prisma.order.aggregate({
      where: { status: "lunas", provider: { not: null } },
      _sum: { subtotal: true, bea: true, biaya_bayar: true, total: true },
      _count: true,
    }),
  ]);
  const perLapak = new Map<string, number>();
  for (const it of items) {
    const n = it.merchant?.name ?? "(lapak dihapus)";
    perLapak.set(n, (perLapak.get(n) ?? 0) + it.unit_price * it.qty);
  }
  const baris = "flex justify-between gap-3 border-b-[1.5px] border-dashed border-kongsi-ink/20 py-[6px] text-[13px] last:border-b-0";

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
      <h3 className="mb-1 font-fraunces text-lg font-black text-kongsi-indigo">Titipan lapak & pendapatan</h3>
      <p className="mb-3 text-[12px] text-kongsi-ink-soft">
        Belanja e-voucher lunas ({agg._count} pesanan). Harga voucher adalah titipan milik lapak; pendapatan Kongsi =
        platform fee.
      </p>
      <div className={baris}>
        <span>Diterima dari pembeli</span>
        <b>{formatKeping(agg._sum.total ?? 0)}</b>
      </div>
      <div className={baris}>
        <span>− Biaya pembayaran (untuk potongan DOKU)</span>
        <span>{formatKeping(agg._sum.biaya_bayar ?? 0)}</span>
      </div>
      <div className={baris}>
        <span>− Titipan lapak (wajib disetor)</span>
        <span>{formatKeping(agg._sum.subtotal ?? 0)}</span>
      </div>
      <div className={baris}>
        <span className="font-bold">= Platform fee (pendapatan Kongsi)</span>
        <b className="text-kongsi-ok">{formatKeping(agg._sum.bea ?? 0)}</b>
      </div>
      {perLapak.size ? (
        <>
          <div className="mt-3 text-[11px] font-bold uppercase tracking-[1.5px] text-kongsi-olive">Titipan per lapak</div>
          {[...perLapak.entries()].map(([n, v]) => (
            <div key={n} className={baris}>
              <span>{n}</span>
              <span>{formatKeping(v)}</span>
            </div>
          ))}
        </>
      ) : null}
      <p className="mt-3 text-[11px] text-kongsi-ink-soft">
        Biaya transfer setoran ke lapak (±Rp2.500 BI-FAST) dibayar dari platform fee — setor mingguan supaya lebih hemat.
      </p>
    </div>
  );
}
