import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import { ApplicationsAdmin } from "@/components/kongsi/ApplicationsAdmin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";
import { formatKeping } from "@/lib/utils";

export default async function KantorKongsiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/masuk");

  if (!isAdmin(user)) {
    return (
      <main className="grain min-h-screen">
        <div className="mx-auto max-w-md px-5 py-24 text-center">
          <div className="font-fraunces text-2xl font-black text-kongsi-grenadine">
            🚫 Akses ditolak
          </div>
          <p className="mt-2 text-kongsi-ink-soft">
            Kantor Kongsi hanya untuk pengurus. Akunmu bukan admin.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block font-bold text-kongsi-grenadine"
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  const { auctions, applications, counts } = await getAdminData();

  const stats = [
    { label: "Lelang aktif", value: String(counts.auctionsAktif), accent: "text-kongsi-grenadine" },
    { label: "Pengajuan Saudagar", value: String(counts.pengajuan) },
    { label: "Loji terdaftar", value: String(counts.loji), accent: "text-kongsi-ok" },
    { label: "Barang lelang", value: String(auctions.length) },
  ];

  return (
    <main className="grain min-h-screen pb-16">
      <div className="sticky top-0 z-50 border-b-2 border-kongsi-ink bg-kongsi-indigo-dark">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-3">
          <Link href="/" className="font-fraunces text-lg font-black text-kongsi-beeswax">
            Kantor Kongsi
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-5 py-8">
        <div className="mb-5">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Kantor Kongsi · Admin
          </div>
          <h2 className="mt-1 font-fraunces text-[30px] font-black text-kongsi-indigo">
            Ruang kendali dagang
          </h2>
        </div>

        <div className="mb-[18px] rounded-[5px] border-2 border-kongsi-grenadine bg-[#FBE3D5] px-[15px] py-[11px] text-[13px] text-kongsi-grenadine-dark">
          ⚠️ <b className="text-kongsi-grenadine">Rahasia:</b> harga deal &amp;
          set di bawah cuma tampil untuk admin (via RLS). Halaman publik pakai{" "}
          <code>auction_items_public</code> tanpa kolom rahasia.
        </div>

        <div className="mb-[22px] grid grid-cols-2 gap-[14px] sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm"
            >
              <div className="text-[11px] font-bold uppercase tracking-[1px] text-kongsi-olive">
                {s.label}
              </div>
              <div
                className={`mt-[3px] font-fraunces text-[26px] font-black ${s.accent ?? "text-kongsi-indigo"}`}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <h3 className="mb-3 font-fraunces text-xl font-black text-kongsi-indigo">
          Barang lelang
        </h3>
        <div className="mb-8 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment text-xs">
            <thead>
              <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
                <th className="p-[10px_12px]">Clue</th>
                <th className="p-[10px_12px]">Loji (rahasia)</th>
                <th className="p-[10px_12px]">Normal</th>
                <th className="p-[10px_12px]">Deal</th>
                <th className="p-[10px_12px]">Set</th>
                <th className="p-[10px_12px]">Margin</th>
                <th className="p-[10px_12px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((a) => {
                const margin =
                  a.set_price != null && a.deal_price != null
                    ? a.set_price - a.deal_price
                    : null;
                return (
                  <tr key={a.id}>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      {a.clue_category}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                      {a.clue_name_masked}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      {formatKeping(a.normal_price)}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                      {a.deal_price != null ? formatKeping(a.deal_price) : "—"}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                      {a.set_price != null ? formatKeping(a.set_price) : "—"}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-ok">
                      {margin != null ? formatKeping(margin) : "—"}
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      {a.status === "tebak" || a.status === "kumpul" ? (
                        <span className="font-bold text-kongsi-grenadine">
                          ● {a.status}
                        </span>
                      ) : (
                        a.status
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3 className="mb-3 font-fraunces text-xl font-black text-kongsi-indigo">
          Pengajuan Saudagar
        </h3>
        <ApplicationsAdmin items={applications} />

        <p className="mt-4 text-[12px] text-kongsi-ink-soft">
          ◆ Kantor Kongsi juga mengelola sengketa Tukar Guling (Syahbandar)
          &amp; artikel Kabar.
        </p>
      </div>
    </main>
  );
}
