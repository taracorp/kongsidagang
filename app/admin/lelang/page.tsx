import { redirect } from "next/navigation";
import { AksiLelang, FormLelangBaru } from "@/components/admin/LelangAdmin";
import { prisma } from "@/lib/db";
import { getAdminData } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { formatKeping } from "@/lib/utils";

const sel = "border-t-[1.5px] border-kongsi-ink/15 p-2 align-top";

/** Kantor Kongsi: Balai Lelang v2 — buat dari produk lapak, mulai, batalkan (tanpa ubah status bebas). */
export default async function AdminLelang() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const [{ auctions }, produk] = await Promise.all([
    getAdminData(),
    prisma.merchantProduct.findMany({
      where: { is_active: true, kind: "evoucher", merchant: { is_active: true } },
      select: { id: true, name: true, price: true, merchant: { select: { name: true } } },
      orderBy: [{ merchant: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-[5px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-[15px] py-[11px] text-[13px] text-kongsi-grenadine-dark">
        ⚠️ <b className="text-kongsi-grenadine">Rahasia:</b> harga deal &amp; set hanya untuk pengurus; halaman publik baru
        membuka harga set saat pemenang diumumkan. Pengurus tidak boleh ikut lelang. Pemenang wajib membayar harga set +
        platform fee + biaya pembayaran sebelum Surat Jalan terbit; tidak bayar → hak turun ke peringkat 2 lalu 3, lalu lelang
        gagal tanpa kewajiban ke lapak.
      </div>

      <FormLelangBaru produk={produk.map((p) => ({ id: p.id, label: `${p.merchant.name} — ${p.name}`, harga: p.price }))} />

      <div className="overflow-x-auto rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment shadow-hard-sm">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead>
            <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
              <th className="p-2">Clue / produk</th>
              <th className="p-2">Normal</th>
              <th className="p-2">Deal</th>
              <th className="p-2">Set</th>
              <th className="p-2">Margin</th>
              <th className="p-2">Status</th>
              <th className="p-2">Pemenang</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {auctions.map((a) => (
              <tr key={a.id} className="even:bg-kongsi-sage/10">
                <td className={sel}>
                  <b>{a.clue_category}</b> {a.type === "vendu" ? "· Vendu" : ""}
                  <div className="text-kongsi-bad">
                    {a.lapak ?? a.clue_name_masked} — {a.produk ?? "—"}
                  </div>
                  <div className="text-kongsi-ink-soft">{a.peserta} peserta</div>
                </td>
                <td className={sel}>{formatKeping(a.normal_price)}</td>
                <td className={`${sel} font-bold text-kongsi-bad`}>{a.deal_price != null ? formatKeping(a.deal_price) : "—"}</td>
                <td className={`${sel} font-bold text-kongsi-bad`}>{a.set_price != null ? formatKeping(a.set_price) : "—"}</td>
                <td className={`${sel} font-bold text-kongsi-ok`}>
                  {a.set_price != null && a.deal_price != null ? formatKeping(a.set_price - a.deal_price) : "—"}
                </td>
                <td className={sel}>
                  <b>{a.status}</b>
                  {a.batal_alasan ? <div className="text-kongsi-ink-soft">{a.batal_alasan}</div> : null}
                </td>
                <td className={sel}>
                  {a.hak.length
                    ? a.hak.map((h) => (
                        <div key={h.peringkat}>
                          #{h.peringkat} {h.nama} · {formatKeping(h.guess)} · <b>{h.status}</b>
                        </div>
                      ))
                    : "—"}
                </td>
                <td className={sel}>
                  <AksiLelang id={a.id} status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
