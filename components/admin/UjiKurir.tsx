"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ujiBatal, ujiBuatPaket, ujiKoneksi, ujiLacak, ujiOngkir, ujiWilayah } from "@/app/actions/kurir-uji";
import type { Lacakan, Tarif, Wilayah } from "@/lib/shipping/kiriminaja";
import { cn, formatKeping } from "@/lib/utils";

// Halaman admin "Uji Kurir": tiap kartu = satu butir UAT MitraAPI (auth, coverage, pricing, create, label,
// tracking, webhook, cancel). Pola kartu & tombol sama dengan halaman admin lain.

const kartu = "rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard-sm";
const judul = "mb-1 font-fraunces text-lg font-black text-kongsi-indigo";
const sub = "mb-3 text-[12px] text-kongsi-ink-soft";
const label = "mb-[3px] block text-[12px] font-bold";
const input =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-[7px] font-work text-[13px] focus:outline-2 focus:outline-kongsi-beeswax";
const tombol =
  "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-3 py-[7px] text-[12px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-60";
const utama = "bg-kongsi-grenadine text-kongsi-parchment";
const kedua = "bg-kongsi-beeswax text-kongsi-ink";
const pesanOk = "mt-3 rounded-[4px] border-2 border-kongsi-ok bg-kongsi-sage/30 px-3 py-2 text-[12px]";
const pesanGagal = "mt-3 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px] text-kongsi-grenadine-dark";

export type PaketUjiBaris = {
  id: string;
  order_id: string;
  awb: string | null;
  sorting_code: string | null;
  pickup_number: string | null;
  courier: string;
  service_name: string;
  skenario: string;
  weight_g: number;
  volume_g: number;
  insurance: number;
  shipping_cost: number;
  status: string;
  status_text: string | null;
  created_at: string;
};
export type LogBaris = { id: string; method: string; payload: string; diproses: number; created_at: string };

const WILAYAH_ASAL: Wilayah = {
  district_id: 5788,
  subdistrict_id: 31554,
  full_address: "Sariharjo, Ngaglik, Sleman, DI Yogyakarta, 55581",
  zipcode: "55581",
};
const WILAYAH_TUJUAN: Wilayah = {
  district_id: 3635,
  subdistrict_id: 46740,
  full_address: "Sawojajar, Kedungkandang, Kota Malang, Jawa Timur, 65139",
  zipcode: "65139",
};

const SKENARIO = [
  { kode: "berat", nama: "Berat barang > berat volume", weight_g: 2000, length_cm: 10, width_cm: 10, height_cm: 10 },
  { kode: "volume", nama: "Berat volume > berat barang", weight_g: 500, length_cm: 40, width_cm: 30, height_cm: 30 },
] as const;

const volume = (l: number, w: number, h: number) => Math.ceil((l * w * h) / 6);
const jam = (s: string) => new Date(s).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });

function PilihWilayah({ nilai, onPilih, id }: { nilai: Wilayah; onPilih: (w: Wilayah) => void; id: string }) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState<Wilayah[]>([]);
  const [err, setErr] = useState<string | null>(null);
  async function cari() {
    setErr(null);
    const { error, data } = await ujiWilayah(q);
    if (error) setErr(error);
    else setHasil(data ?? []);
  }
  return (
    <div>
      <div className="text-[12px]">
        <b>{nilai.full_address}</b>
        <span className="text-kongsi-ink-soft">
          {" "}
          · kec {nilai.district_id} · kel {nilai.subdistrict_id}
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="cari kelurahan/kecamatan" className={input} />
        <button type="button" onClick={cari} className={cn(tombol, kedua)}>
          Cari
        </button>
      </div>
      {err ? <p className="text-[11px] text-kongsi-bad">{err}</p> : null}
      {hasil.length ? (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-[3px] border-2 border-kongsi-ink/30 bg-white text-[12px]">
          {hasil.map((w) => (
            <li key={`${w.district_id}-${w.subdistrict_id}`}>
              <button
                type="button"
                className="w-full cursor-pointer px-2 py-1 text-left hover:bg-kongsi-beeswax"
                onClick={() => {
                  onPilih(w);
                  setHasil([]);
                }}
              >
                {w.full_address} <span className="text-kongsi-ink-soft">({w.district_id}/{w.subdistrict_id})</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function UjiKurir({
  info,
  paket,
  log,
}: {
  info: { terpasang: boolean; driver: string | null; sandbox: boolean; base: string | null };
  paket: PaketUjiBaris[];
  log: LogBaris[];
}) {
  const router = useRouter();

  // 1. Autentikasi
  const [koneksi, setKoneksi] = useState<{ ok: boolean; teks: string } | null>(null);
  async function cekKoneksi() {
    setKoneksi(null);
    const { error, data } = await ujiKoneksi();
    setKoneksi(
      error
        ? { ok: false, teks: error }
        : { ok: true, teks: `Authorized ✓ — API key valid (${data!.ms} ms). Jadwal pickup terdekat: ${data!.jadwal}` },
    );
  }

  // 2–3. Cakupan & ongkir
  const [asal, setAsal] = useState<Wilayah>(WILAYAH_ASAL);
  const [tujuan, setTujuan] = useState<Wilayah>(WILAYAH_TUJUAN);
  const [skenario, setSkenario] = useState<(typeof SKENARIO)[number]>(SKENARIO[0]);
  const [nilaiBarang, setNilaiBarang] = useState(250_000);
  const [tarif, setTarif] = useState<Tarif[] | null>(null);
  const [errTarif, setErrTarif] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);
  const dim = { weight_g: skenario.weight_g, length_cm: skenario.length_cm, width_cm: skenario.width_cm, height_cm: skenario.height_cm };
  async function cekOngkir() {
    setMemuat(true);
    setErrTarif(null);
    const { error, data } = await ujiOngkir(asal, tujuan, { ...dim, item_value: nilaiBarang });
    setMemuat(false);
    if (error) setErrTarif(error);
    else setTarif(data ?? []);
  }

  // 4. Buat paket
  const [pilih, setPilih] = useState<Tarif | null>(null);
  const [asuransi, setAsuransi] = useState(false);
  const [item, setItem] = useState("Kain batik tulis (UAT)");
  const [qty, setQty] = useState(2);
  const [pengirim, setPengirim] = useState({ name: "Kongsi Dagang UAT", phone: "081234567890", address: "Jl. Palagan Tentara Pelajar No. 77, RT 001/RW 033, Sedan" });
  const [penerima, setPenerima] = useState({ name: "Penerima UAT", phone: "082200000000", address: "Jl. Danau Ranau No. 12, Sawojajar" });
  const [hasilBuat, setHasilBuat] = useState<{ ok: boolean; teks: string } | null>(null);
  async function buat() {
    if (!pilih) return;
    setMemuat(true);
    setHasilBuat(null);
    const { error, data } = await ujiBuatPaket({
      pengirim: { ...pengirim, lat: -7.7393368, lng: 110.3734844, wilayah: asal },
      penerima: { ...penerima, lat: -7.976862, lng: 112.6564411, wilayah: tujuan },
      paket: { ...dim, item_value: nilaiBarang },
      item_name: item,
      qty,
      courier: pilih.courier,
      service_type: pilih.service_type,
      asuransi,
      skenario: `Non-COD · ${skenario.nama}${asuransi ? " · asuransi" : ""}`,
    });
    setMemuat(false);
    setHasilBuat(
      error
        ? { ok: false, teks: error }
        : { ok: true, teks: `Order ID ${data!.order_id} terbentuk${data!.awb ? ` · AWB ${data!.awb}` : " · AWB menyusul (webhook/lacak)"}` },
    );
    if (!error) router.refresh();
  }

  // 5–7. Lacak & batal
  const [lacak, setLacak] = useState<Record<string, Lacakan | string>>({});
  async function lacakPaket(id: string) {
    const { error, data } = await ujiLacak(id);
    setLacak((s) => ({ ...s, [id]: error ?? data! }));
    router.refresh();
  }
  const [batal, setBatal] = useState<Record<string, string>>({});
  async function batalPaket(id: string) {
    const { error, data } = await ujiBatal(id, "Uji pembatalan UAT Kongsi Dagang");
    setBatal((s) => ({ ...s, [id]: error ? `Gagal: ${error}` : `${data!.text} ${JSON.stringify(data!.data)}` }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className={kartu}>
        <h3 className={judul}>1 · Autentikasi API key</h3>
        <p className={sub}>
          Driver: <b>{info.driver ?? "belum terpasang"}</b> · Endpoint: <b>{info.base ?? "-"}</b> ·{" "}
          {info.driver === "tiruan" ? (
            <b className="text-kongsi-ink-soft">TIRUAN (dev)</b>
          ) : info.sandbox ? (
            <b className="text-kongsi-grenadine">SANDBOX</b>
          ) : (
            <b className="text-kongsi-ok">PRODUKSI</b>
          )}{" "}
          · key
          disimpan di server (tidak ditampilkan)
        </p>
        <button type="button" onClick={cekKoneksi} className={cn(tombol, utama)}>
          Uji API key
        </button>
        {koneksi ? <p className={koneksi.ok ? pesanOk : pesanGagal}>{koneksi.teks}</p> : null}
      </div>

      <div className={kartu}>
        <h3 className={judul}>2–3 · Cakupan wilayah, layanan kurir & ongkir</h3>
        <p className={sub}>Cari kelurahan (endpoint addresses), lalu cek ongkir (shipping_price) untuk paket di bawah.</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <span className={label}>Asal (pengirim)</span>
            <PilihWilayah id="wil-asal" nilai={asal} onPilih={setAsal} />
          </div>
          <div>
            <span className={label}>Tujuan (penerima)</span>
            <PilihWilayah id="wil-tujuan" nilai={tujuan} onPilih={setTujuan} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SKENARIO.map((s) => (
            <button
              key={s.kode}
              type="button"
              onClick={() => {
                setSkenario(s);
                setTarif(null);
                setPilih(null);
              }}
              aria-pressed={s.kode === skenario.kode}
              className={cn(tombol, s.kode === skenario.kode ? utama : "bg-kongsi-parchment")}
            >
              {s.nama}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px]">
          Berat barang <b>{dim.weight_g.toLocaleString("id-ID")} g</b> · dimensi {dim.length_cm}×{dim.width_cm}×{dim.height_cm} cm ·
          berat volume <b>{volume(dim.length_cm, dim.width_cm, dim.height_cm).toLocaleString("id-ID")} g</b> (÷6000)
        </p>
        <div className="mt-2 flex items-end gap-2">
          <label className="flex-1">
            <span className={label}>Nilai barang (Rp)</span>
            <input inputMode="numeric" value={nilaiBarang} onChange={(e) => setNilaiBarang(Number(e.target.value.replace(/\D/g, "")) || 0)} className={input} />
          </label>
          <button type="button" onClick={cekOngkir} disabled={memuat} className={cn(tombol, utama)}>
            Cek ongkir
          </button>
        </div>
        {errTarif ? <p className={pesanGagal}>{errTarif}</p> : null}
        {tarif ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-kongsi-indigo-dark text-left text-kongsi-parchment">
                  <th className="p-2">Kurir</th>
                  <th className="p-2">Layanan</th>
                  <th className="p-2">Ongkir</th>
                  <th className="p-2">Asuransi</th>
                  <th className="p-2">ETD</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {tarif.map((t) => (
                  <tr key={`${t.courier}-${t.service_type}`} className="border-b border-kongsi-ink/15">
                    <td className="p-2 font-bold uppercase">{t.courier}</td>
                    <td className="p-2">
                      {t.service_name} <span className="text-kongsi-ink-soft">({t.service_type})</span>
                    </td>
                    <td className="p-2">{formatKeping(t.cost)}</td>
                    <td className="p-2">
                      {formatKeping(t.insurance)}
                      {t.force_insurance ? <b className="ml-1 text-kongsi-grenadine">wajib</b> : null}
                    </td>
                    <td className="p-2">{t.etd ?? "-"}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPilih(t);
                          setAsuransi(Boolean(t.force_insurance) || asuransi);
                        }}
                        className={cn(tombol, pilih === t ? utama : "bg-kongsi-parchment")}
                      >
                        Pilih
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-kongsi-ink-soft">{tarif.length} layanan tersedia untuk rute ini.</p>
          </div>
        ) : null}
      </div>

      <div className={kartu}>
        <h3 className={judul}>4 · Buat paket Non-COD</h3>
        <p className={sub}>
          Endpoint request_pickup v6.2. Ongkir & asuransi diambil ulang dari tarif server. COD & KA Credit tidak dipakai Kongsi.
        </p>
        {pilih ? (
          <>
            <p className="text-[12px]">
              Layanan: <b>{pilih.service_name}</b> ({pilih.courier}/{pilih.service_type}) · ongkir {formatKeping(pilih.cost)} · skenario{" "}
              <b>{skenario.nama}</b>
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label>
                <span className={label}>Nama barang</span>
                <input value={item} onChange={(e) => setItem(e.target.value)} className={input} />
              </label>
              <label>
                <span className={label}>Jumlah item</span>
                <input inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 1)} className={input} />
              </label>
              {(["pengirim", "penerima"] as const).map((k) => {
                const v = k === "pengirim" ? pengirim : penerima;
                const set = k === "pengirim" ? setPengirim : setPenerima;
                return (
                  <fieldset key={k} className="rounded-[4px] border-2 border-kongsi-ink/20 p-2">
                    <legend className="px-1 text-[12px] font-bold capitalize">{k}</legend>
                    <input aria-label={`Nama ${k}`} value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} className={cn(input, "mb-1")} />
                    <input aria-label={`HP ${k}`} value={v.phone} onChange={(e) => set({ ...v, phone: e.target.value })} className={cn(input, "mb-1")} />
                    <input aria-label={`Alamat ${k}`} value={v.address} onChange={(e) => set({ ...v, address: e.target.value })} className={input} />
                  </fieldset>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 text-[13px] font-bold">
              <input type="checkbox" checked={asuransi} disabled={pilih.force_insurance} onChange={(e) => setAsuransi(e.target.checked)} />
              Pakai asuransi ({formatKeping(pilih.insurance)}){pilih.force_insurance ? " — wajib untuk layanan ini" : ""}
            </label>
            <button type="button" onClick={buat} disabled={memuat} className={cn(tombol, utama, "mt-3")}>
              {memuat ? "Membuat…" : "Buat paket"}
            </button>
          </>
        ) : (
          <p className="text-[12px] text-kongsi-ink-soft">Cek ongkir lalu pilih satu layanan dulu.</p>
        )}
        {hasilBuat ? <p className={hasilBuat.ok ? pesanOk : pesanGagal}>{hasilBuat.teks}</p> : null}
      </div>

      <div className={kartu}>
        <h3 className={judul}>5–7 · Paket uji: label, lacak, batal</h3>
        <p className={sub}>Lacak = endpoint tracking. Batal = cancel_shipment (butuh AWB, sebelum dijemput).</p>
        {paket.length === 0 ? <p className="text-[12px] text-kongsi-ink-soft">Belum ada paket uji.</p> : null}
        <div className="space-y-3">
          {paket.map((p) => {
            const l = lacak[p.id];
            return (
              <div key={p.id} className="rounded-[4px] border-2 border-kongsi-ink/30 bg-kongsi-parchment-3 p-3 text-[12px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <b className="font-fraunces text-[14px] text-kongsi-indigo">{p.order_id}</b> · {p.skenario}
                    <div>
                      AWB <b>{p.awb ?? "—"}</b> · sorting <b>{p.sorting_code ?? "—"}</b> · {p.courier.toUpperCase()} {p.service_name} · berat{" "}
                      {p.weight_g} g / volume {p.volume_g} g · ongkir {formatKeping(p.shipping_cost)} · asuransi{" "}
                      {p.insurance ? formatKeping(p.insurance) : "tidak"}
                    </div>
                    <div className="text-kongsi-ink-soft">
                      {p.status} · {p.status_text ?? ""} · {jam(p.created_at)}
                      {p.pickup_number ? ` · pickup ${p.pickup_number}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/label/uji/${p.id}`} target="_blank" rel="noopener noreferrer" className={cn(tombol, kedua)}>
                      Label
                    </a>
                    <button type="button" onClick={() => lacakPaket(p.id)} className={cn(tombol, "bg-kongsi-parchment")}>
                      Lacak
                    </button>
                    <button type="button" onClick={() => batalPaket(p.id)} disabled={p.status === "canceled"} className={cn(tombol, "bg-kongsi-parchment")}>
                      Batalkan
                    </button>
                  </div>
                </div>
                {typeof l === "string" ? <p className={pesanGagal}>{l}</p> : null}
                {l && typeof l !== "string" ? (
                  <div className={pesanOk}>
                    <b>{l.text}</b> · AWB {l.awb ?? "—"} · sorting {l.sorting_code ?? "—"} · {l.service ?? ""} {l.service_name ?? ""}
                    <ul className="mt-1 list-disc pl-4">
                      {l.histories.map((h, i) => (
                        <li key={i}>
                          {h.at ?? ""} — {h.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {batal[p.id] ? <p className={batal[p.id].startsWith("Gagal") ? pesanGagal : pesanOk}>{batal[p.id]}</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className={kartu}>
        <h3 className={judul}>8 · Webhook / callback diterima</h3>
        <p className={sub}>
          URL callback: <b>/api/kiriminaja/webhook</b> (diverifikasi header Authorization: Bearer api_key). 20 terakhir.
        </p>
        {log.length === 0 ? <p className="text-[12px] text-kongsi-ink-soft">Belum ada callback.</p> : null}
        <div className="space-y-2">
          {log.map((g) => (
            <details key={g.id} className="rounded-[4px] border-2 border-kongsi-ink/20 bg-white p-2 text-[12px]">
              <summary className="cursor-pointer">
                <b>{g.method}</b> · {jam(g.created_at)} · diproses {g.diproses}
              </summary>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px]">{g.payload}</pre>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
