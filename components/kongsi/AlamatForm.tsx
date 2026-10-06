"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cariWilayah, simpanAlamat, hapusAlamat } from "@/app/actions/tukar";
import { cn } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";

const input =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[5px] block text-[13px] font-bold";

type Wilayah = { district_id: number; subdistrict_id: number; full_address: string };

export function AlamatForm() {
  const router = useRouter();
  const [f, setF] = useState({ label: "Rumah", name: "", phone: "", address: "" });
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Wilayah[]>([]);
  const [cari, setCari] = useState<{ busy: boolean; err: string | null }>({ busy: false, err: null });
  const [w, setW] = useState<Wilayah | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Cari kelurahan dengan jeda ketik 500ms (API wilayah dibatasi).
  useEffect(() => {
    const kata = q.trim();
    if (w || kata.length < 3) return;
    const t = setTimeout(async () => {
      setCari({ busy: true, err: null });
      const { data, error } = await cariWilayah(kata);
      setCari({ busy: false, err: error });
      setHasil(data ?? []);
    }, 500);
    return () => clearTimeout(t);
  }, [q, w]);

  function lokasiku() {
    setGeoMsg("Mengambil lokasi…");
    if (!navigator.geolocation) {
      setGeoMsg("Browser tidak mendukung lokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoMsg(null);
      },
      () => setGeoMsg("Izin lokasi ditolak. Aktifkan lokasi lalu coba lagi."),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  async function simpan() {
    if (!w) {
      setErr("Pilih kelurahan dari hasil pencarian.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await simpanAlamat({
      ...f,
      area: w.full_address,
      district_id: w.district_id,
      subdistrict_id: w.subdistrict_id,
      lat: geo?.lat ?? NaN,
      lng: geo?.lng ?? NaN,
    });
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setF({ label: "Rumah", name: "", phone: "", address: "" });
    setW(null);
    setQ("");
    setGeo(null);
    router.refresh();
  }

  const ubah = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard">
      <h3 className="mb-3 font-fraunces text-lg font-black text-kongsi-indigo">Tambah alamat</h3>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="label">Label</label>
          <input id="label" value={f.label} onChange={ubah("label")} className={input} maxLength={30} />
        </div>
        <div>
          <label className={label} htmlFor="phone">No. HP</label>
          <input id="phone" inputMode="tel" value={f.phone} onChange={ubah("phone")} className={input} placeholder="08…" />
        </div>
      </div>
      <div className="mb-3">
        <label className={label} htmlFor="name">Nama penerima</label>
        <input id="name" value={f.name} onChange={ubah("name")} className={input} maxLength={60} />
      </div>
      <div className="mb-3">
        <label className={label} htmlFor="wilayah">Kelurahan / kecamatan / kode pos</label>
        {w ? (
          <div className="flex items-center justify-between gap-2 rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-3 px-3 py-[10px] text-sm">
            <span>{w.full_address}</span>
            <button type="button" className="cursor-pointer text-[12px] font-bold text-kongsi-grenadine" onClick={() => setW(null)}>
              Ganti
            </button>
          </div>
        ) : (
          <>
            <input
              id="wilayah"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={input}
              placeholder="ketik min. 3 huruf, cth. Sariharjo atau 55581"
            />
            {cari.busy ? <p className="mt-1 text-[12px] text-kongsi-ink-soft">Mencari…</p> : null}
            {cari.err ? <p className="mt-1 text-[12px] text-kongsi-bad">{cari.err}</p> : null}
            {hasil.length ? (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-[3px] border-2 border-kongsi-ink bg-white">
                {hasil.map((h) => (
                  <li key={h.subdistrict_id}>
                    <button
                      type="button"
                      onClick={() => {
                        setW(h);
                        setHasil([]);
                      }}
                      className="block w-full cursor-pointer border-b border-kongsi-ink/10 px-3 py-2 text-left text-[13px] hover:bg-kongsi-sage/30"
                    >
                      {h.full_address}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
      <div className="mb-3">
        <label className={label} htmlFor="address">Jalan, nomor rumah, RT/RW, patokan</label>
        <input id="address" value={f.address} onChange={ubah("address")} className={input} maxLength={200} />
      </div>
      <div className="mb-3">
        <div className={label}>Titik jemput kurir</div>
        <button
          type="button"
          onClick={lokasiku}
          className={cn(
            "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-4 py-[10px] text-[13px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]",
            geo ? "bg-kongsi-sage" : "bg-kongsi-parchment hover:bg-kongsi-beeswax",
          )}
        >
          {geo ? `✓ Lokasi tersimpan (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})` : "📍 Pakai lokasiku"}
        </button>
        {geoMsg ? <p className="mt-1 text-[12px] text-kongsi-ink-soft">{geoMsg}</p> : null}
        <p className="mt-1 text-[11px] text-kongsi-ink-soft">Ambil lokasi saat kamu berada di alamat ini.</p>
      </div>
      {err ? (
        <p className="mb-3 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
          {err}
        </p>
      ) : null}
      <KongsiButton type="button" block disabled={busy} onClick={simpan}>
        {busy ? "Menyimpan…" : "Simpan alamat"}
      </KongsiButton>
    </div>
  );
}

export function HapusAlamat({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { error } = await hapusAlamat(id);
          setBusy(false);
          if (error) setErr(error);
          else router.refresh();
        }}
        className="cursor-pointer text-[12px] font-bold text-kongsi-bad disabled:opacity-60"
      >
        Hapus
      </button>
      {err ? <div className="text-[11px] text-kongsi-bad">{err}</div> : null}
    </div>
  );
}
