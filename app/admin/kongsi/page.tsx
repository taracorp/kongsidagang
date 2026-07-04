import Link from "next/link";
import { redirect } from "next/navigation";
import { KongsiButton } from "@/components/kongsi/KongsiButton";
import { LogoutButton } from "@/components/kongsi/LogoutButton";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";

type Row = {
  no: number;
  loji: string;
  clue: string;
  normal: string;
  deal: string;
  set: string;
  margin: string;
  status: "berjalan" | "antre";
};

const rows: Row[] = [
  { no: 0, loji: "Hotel Artotel", clue: "A••••••• · Hotel B4 Jogja", normal: "500rb", deal: "400rb", set: "470rb", margin: "70rb", status: "berjalan" },
  { no: 1, loji: "Spa Amanjiwo", clue: "A••••••• · Spa Mewah", normal: "450rb", deal: "300rb", set: "360rb", margin: "60rb", status: "antre" },
  { no: 2, loji: "Kaum Jakarta", clue: "K•••• · Fine Dining", normal: "500rb", deal: "320rb", set: "400rb", margin: "80rb", status: "antre" },
];

const stats = [
  { label: "Lelang aktif", value: "Fase 2", accent: "text-kongsi-grenadine" },
  { label: "Peserta sekarang", value: "7" },
  { label: "Untung hari ini", value: "Rp 210rb", accent: "text-kongsi-ok" },
  { label: "Skip rate", value: "12%" },
];

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
          harga set hanya tampil di sini. Halaman publik pakai{" "}
          <code>auction_items_public</code> (tanpa kolom rahasia).
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

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-fraunces text-xl font-black text-kongsi-indigo">
            Barang lelang
          </h3>
          <KongsiButton variant="gold">+ Tambah Barang</KongsiButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment text-xs">
            <thead>
              <tr className="bg-kongsi-indigo-dark text-left font-fraunces text-kongsi-parchment">
                <th className="p-[10px_12px]">#</th>
                <th className="p-[10px_12px]">Loji (rahasia)</th>
                <th className="p-[10px_12px]">Clue</th>
                <th className="p-[10px_12px]">Normal</th>
                <th className="p-[10px_12px]">Deal</th>
                <th className="p-[10px_12px]">Set</th>
                <th className="p-[10px_12px]">Margin</th>
                <th className="p-[10px_12px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.no}>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">{r.no}</td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                    {r.loji}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">{r.clue}</td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">{r.normal}</td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                    {r.deal}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-bad">
                    {r.set}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px] font-bold text-kongsi-ok">
                    {r.margin}
                  </td>
                  <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                    {r.status === "berjalan" ? (
                      <span className="font-bold text-kongsi-grenadine">● berjalan</span>
                    ) : (
                      "antre"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-kongsi-ink-soft">
          ◆ Kantor Kongsi juga mengelola: pengajuan Saudagar (cap segel),
          sengketa Tukar Guling (Syahbandar), &amp; artikel Kabar.
        </p>
      </div>
    </main>
  );
}
