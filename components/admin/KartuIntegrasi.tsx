import { dokuConfig } from "@/lib/payment/doku";
import { kirimAktif } from "@/lib/shipping/kiriminaja";

type Status = { nama: string; aktif: boolean; ket: string; langkah?: string[] };

async function cekSearxng(): Promise<boolean> {
  try {
    const base = (process.env.SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/$/, "");
    const r = await fetch(`${base}/search?q=tes&format=json`, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Status integrasi pihak ketiga + langkah aktivasi (dibaca dari env server; kunci tidak pernah ditampilkan). */
export async function KartuIntegrasi() {
  const daftar: Status[] = [
    {
      nama: "DOKU (Isi Pundi)",
      aktif: !!dokuConfig() && process.env.DOKU_MOCK !== "true",
      ket: process.env.DOKU_MOCK === "true" ? "mode tiruan" : (process.env.DOKU_BASE_URL ?? "https://api.doku.com"),
      langkah: ["Isi DOKU_CLIENT_ID & DOKU_SECRET_KEY (SK-…) di .env VPS", "URL notifikasi Back Office: /api/doku/notifikasi"],
    },
    {
      nama: "KiriminAja (Tukar Guling mode Kirim)",
      aktif: kirimAktif() && process.env.KIRIMINAJA_MOCK !== "true",
      ket: kirimAktif() ? "aktif" : "menunggu API key — mode Kirim & Alamat kirim disembunyikan",
      langkah: [
        "Isi KIRIMINAJA_API_KEY (+ KIRIMINAJA_PIN untuk KA Credit) di .env VPS",
        "Jalankan: bash scripts/kiriminaja-aktifkan.sh (daftarkan callback webhook)",
        "pm2 restart kongsidagang --update-env",
      ],
    },
    { nama: "SearXNG (Juru Taksir)", aktif: await cekSearxng(), ket: "mesin pencari internal 127.0.0.1:8888", langkah: ["bash scripts/searxng.sh di VPS"] },
  ];

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm">
      <h3 className="mb-3 font-fraunces text-lg font-black text-kongsi-indigo">Integrasi</h3>
      <ul className="space-y-3 text-[13px]">
        {daftar.map((d) => (
          <li key={d.nama} className="border-b-[1.5px] border-dashed border-kongsi-ink/20 pb-2 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <b>{d.nama}</b>
              <span className={d.aktif ? "font-bold text-kongsi-ok" : "font-bold text-kongsi-bad"}>{d.aktif ? "● aktif" : "○ belum aktif"}</span>
              <span className="text-kongsi-ink-soft">· {d.ket}</span>
            </div>
            {!d.aktif && d.langkah ? (
              <ol className="mt-1 list-decimal pl-5 text-kongsi-ink-soft">
                {d.langkah.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
