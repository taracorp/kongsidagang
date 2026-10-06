"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  tambahProduk,
  ubahProduk,
  aturProdukAktif,
  hapusProduk,
  tambahCabang,
  ubahCabang,
  aturCabangAktif,
  ubahProfilLapak,
} from "@/app/actions/loji";
import { tebusVoucher } from "@/app/actions/belanja";
import type { LapakKelola } from "@/lib/queries-lapak";
import { cn, formatKeping } from "@/lib/utils";

const fieldInput = "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-2 py-1 text-sm outline-none";
const tombolKecil = "cursor-pointer rounded-[3px] border-2 border-kongsi-ink px-2 py-[3px] text-xs font-bold disabled:opacity-60";
const kartu = "rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm";
const judul = "mb-3 font-fraunces text-lg font-black text-kongsi-indigo";

function useJalankan() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function jalankan(f: () => Promise<{ error: string | null }>, sukses?: () => void) {
    setBusy(true);
    setMsg(null);
    const { error } = await f();
    setBusy(false);
    if (error) return setMsg(error);
    sukses?.();
    router.refresh();
  }
  return { busy, msg, jalankan };
}

// ============================================================
// Profil lapak
// ============================================================

export function ProfilLapak({ m }: { m: LapakKelola }) {
  const { busy, msg, jalankan } = useJalankan();
  return (
    <form
      className={kartu}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        jalankan(() => ubahProfilLapak(m.id, f));
      }}
    >
      <h3 className={judul}>Profil lapak</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] font-bold sm:col-span-2">
          Deskripsi
          <textarea name="description" defaultValue={m.description ?? ""} rows={2} maxLength={600} className={fieldInput} />
        </label>
        <label className="text-[12px] font-bold">
          WhatsApp
          <input name="whatsapp" defaultValue={m.whatsapp ?? ""} className={fieldInput} />
        </label>
        <label className="text-[12px] font-bold">
          Jam buka
          <input name="hours" defaultValue={m.hours ?? ""} className={fieldInput} />
        </label>
        <label className="text-[12px] font-bold">
          Status
          <select name="status" defaultValue={m.status === "obral" ? "buka" : m.status} className={fieldInput}>
            <option value="buka">Buka (menerima pesanan)</option>
            <option value="segera">Segera hadir</option>
            <option value="tutup">Tutup sementara</option>
          </select>
        </label>
      </div>
      <button type="submit" disabled={busy} className={cn(tombolKecil, "mt-3 bg-kongsi-grenadine px-3 py-1 text-sm text-kongsi-parchment")}>
        Simpan profil
      </button>
      {msg ? <p className="mt-2 text-[12px] text-kongsi-bad">{msg}</p> : null}
    </form>
  );
}

// ============================================================
// Cabang
// ============================================================

export function CabangManager({ m }: { m: LapakKelola }) {
  const { busy, msg, jalankan } = useJalankan();
  const [ubah, setUbah] = useState<string | null>(null);
  return (
    <div className={kartu}>
      <h3 className={judul}>Cabang ({m.branches.filter((b) => b.is_active).length} aktif)</h3>
      <ul className="mb-3 space-y-2 text-[13px]">
        {m.branches.map((b) =>
          ubah === b.id ? (
            <li key={b.id}>
              <form
                className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  jalankan(() => ubahCabang(b.id, f), () => setUbah(null));
                }}
              >
                <input name="name" defaultValue={b.name} className={fieldInput} />
                <input name="city" defaultValue={b.city ?? ""} placeholder="kota" className={fieldInput} />
                <input name="address" defaultValue={b.address} className={fieldInput} />
                <button type="submit" disabled={busy} className={cn(tombolKecil, "bg-kongsi-ok text-kongsi-parchment")}>
                  Simpan
                </button>
              </form>
            </li>
          ) : (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 border-b-[1.5px] border-dashed border-kongsi-ink/20 pb-2">
              <div className={b.is_active ? "" : "opacity-60"}>
                <b>{b.name}</b>
                {b.city ? <span className="text-kongsi-olive"> · {b.city}</span> : null}
                <div className="text-kongsi-ink-soft">{b.address}</div>
              </div>
              <span className="flex gap-2">
                <button type="button" onClick={() => setUbah(b.id)} className={cn(tombolKecil, "bg-kongsi-parchment-3")}>
                  Ubah
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => jalankan(() => aturCabangAktif(b.id, !b.is_active))}
                  className={cn(tombolKecil, "bg-kongsi-parchment-3")}
                >
                  {b.is_active ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      <form
        className="grid gap-2 rounded-[5px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          jalankan(() => tambahCabang(m.id, f), () => form.reset());
        }}
      >
        <input name="name" placeholder="Nama cabang" className={fieldInput} />
        <input name="city" placeholder="Kota" className={fieldInput} />
        <input name="address" placeholder="Alamat lengkap" className={fieldInput} />
        <button type="submit" disabled={busy} className={cn(tombolKecil, "bg-kongsi-grenadine text-kongsi-parchment")}>
          + Cabang
        </button>
      </form>
      {msg ? <p className="mt-2 text-[12px] text-kongsi-bad">{msg}</p> : null}
    </div>
  );
}

// ============================================================
// Produk (e-voucher)
// ============================================================

type Produk = LapakKelola["products"][number];

function IsianProduk({ p, kategori }: { p?: Produk; kategori: string[] }) {
  return (
    <>
      <input name="name" defaultValue={p?.name} placeholder="Nama perawatan" className={cn(fieldInput, "sm:col-span-2")} />
      <input name="price" defaultValue={p?.price} inputMode="numeric" placeholder="Harga (Rp)" className={fieldInput} />
      <input name="old_price" defaultValue={p?.old_price ?? ""} inputMode="numeric" placeholder="Harga coret" className={fieldInput} />
      <input name="category" defaultValue={p?.category ?? ""} list="kategori-produk" placeholder="Kategori" className={fieldInput} />
      <datalist id="kategori-produk">
        {kategori.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <input name="valid_days" defaultValue={p?.valid_days ?? 90} inputMode="numeric" placeholder="Berlaku (hari)" className={fieldInput} />
      <input name="tags" defaultValue={p?.tags.join(", ")} placeholder="tag: jerawat, glow, …" className={cn(fieldInput, "sm:col-span-2")} />
      <input name="description" defaultValue={p?.description ?? ""} placeholder="Deskripsi singkat" className={cn(fieldInput, "sm:col-span-3")} />
      <label className="flex items-center gap-2 text-[12px] font-bold">
        <input type="checkbox" name="is_featured" defaultChecked={p?.is_featured} /> Etalase
      </label>
    </>
  );
}

export function ProdukManager({ m }: { m: LapakKelola }) {
  const { busy, msg, jalankan } = useJalankan();
  const [editing, setEditing] = useState<string | null>(null);
  const kategori = [...new Set(m.products.map((p) => p.category).filter((k): k is string => !!k))];

  return (
    <div className={kartu}>
      <h3 className={judul}>E-voucher perawatan ({m.products.length})</h3>
      <form
        className="mb-3 grid grid-cols-2 gap-2 rounded-[5px] border-2 border-dashed border-kongsi-ink bg-kongsi-parchment-3 p-3 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          jalankan(() => tambahProduk(m.id, f), () => form.reset());
        }}
      >
        <IsianProduk kategori={kategori} />
        <button type="submit" disabled={busy} className={cn(tombolKecil, "col-span-2 bg-kongsi-grenadine py-1 text-sm text-kongsi-parchment sm:col-span-4")}>
          + Tambah e-voucher
        </button>
      </form>
      {msg ? <p className="mb-2 text-[12px] text-kongsi-bad">{msg}</p> : null}

      <div className="overflow-x-auto rounded-[5px] border-2 border-kongsi-ink bg-kongsi-parchment">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-kongsi-indigo text-left font-fraunces text-xs text-kongsi-parchment">
              <th className="p-[9px_12px]">Perawatan</th>
              <th className="p-[9px_12px]">Harga</th>
              <th className="p-[9px_12px]">Status</th>
              <th className="p-[9px_12px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {m.products.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-[13px] text-kongsi-ink-soft">
                  Belum ada e-voucher.
                </td>
              </tr>
            ) : (
              m.products.map((p) =>
                editing === p.id ? (
                  <tr key={p.id} className="bg-kongsi-sage/10">
                    <td colSpan={4} className="border-t-[1.5px] border-kongsi-ink/15 p-2">
                      <form
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          jalankan(() => ubahProduk(p.id, f), () => setEditing(null));
                        }}
                      >
                        <IsianProduk p={p} kategori={kategori} />
                        <span className="col-span-2 flex gap-2 sm:col-span-4">
                          <button type="submit" disabled={busy} className={cn(tombolKecil, "bg-kongsi-ok px-3 text-kongsi-parchment")}>
                            Simpan
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className={cn(tombolKecil, "px-3")}>
                            Batal
                          </button>
                        </span>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="even:bg-kongsi-sage/10">
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[11px] text-kongsi-ink-soft">
                        {p.category ?? "tanpa kategori"} · {p.valid_days} hari{p.is_featured ? " · etalase" : ""}
                        {p.tags.length ? ` · ${p.tags.join(", ")}` : ""}
                      </div>
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">{formatKeping(p.price)}</td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      <span
                        className={cn(
                          "rounded-full border-[1.5px] border-kongsi-ink px-2 py-[1px] text-[11px] font-bold",
                          p.is_active ? "bg-kongsi-sage" : "bg-kongsi-parchment-2 text-kongsi-ink-soft",
                        )}
                      >
                        {p.is_active ? "aktif" : "nonaktif"}
                      </span>
                    </td>
                    <td className="border-t-[1.5px] border-kongsi-ink/15 p-[9px_12px]">
                      <span className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditing(p.id)} className={cn(tombolKecil, "bg-kongsi-parchment-3")}>
                          Ubah
                        </button>
                        <button type="button" disabled={busy} onClick={() => jalankan(() => aturProdukAktif(p.id, !p.is_active))} className={cn(tombolKecil, "bg-kongsi-parchment-3")}>
                          {p.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button type="button" disabled={busy} onClick={() => jalankan(() => hapusProduk(p.id))} className={cn(tombolKecil, "bg-kongsi-parchment-3 text-kongsi-bad")}>
                          Hapus
                        </button>
                      </span>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Validasi voucher (petugas cabang)
// ============================================================

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;
const tanpaLangganan = () => () => {};

export function ValidasiVoucher({ m }: { m: LapakKelola }) {
  const router = useRouter();
  const cabang = m.branches.filter((b) => b.is_active);
  const [branchId, setBranchId] = useState(cabang[0]?.id ?? "");
  const [kode, setKode] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasil, setHasil] = useState<{ ok: boolean; teks: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bisaKamera = useSyncExternalStore(
    tanpaLangganan,
    () => "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function tebus(input: string) {
    const bersih = input.replace(/^KDV:/i, "");
    if (!branchId) return setHasil({ ok: false, teks: "Pilih cabang tempatmu bertugas." });
    setBusy(true);
    setHasil(null);
    const { error, data } = await tebusVoucher(m.id, branchId, bersih);
    setBusy(false);
    if (error) return setHasil({ ok: false, teks: error });
    setKode("");
    setHasil({ ok: true, teks: `✓ ${data?.title} — atas nama ${data?.pemilik}${data?.cabang ? ` · ${data.cabang}` : ""} (${data?.kode})` });
    router.refresh();
  }

  async function mulaiKamera() {
    setHasil(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const det = new (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current) return;
        const found = await det.detect(video).catch(() => []);
        if (found[0]?.rawValue) {
          stop();
          await tebus(found[0].rawValue);
          return;
        }
        setTimeout(loop, 400);
      };
      loop();
    } catch {
      stop();
      setHasil({ ok: false, teks: "Kamera tidak bisa dibuka. Ketik kodenya saja." });
    }
  }

  return (
    <div className={kartu}>
      <h3 className={judul}>Validasi voucher</h3>
      {cabang.length === 0 ? (
        <p className="text-[13px] text-kongsi-ink-soft">Tambahkan cabang dulu.</p>
      ) : (
        <>
          <label className="mb-2 block text-[12px] font-bold">
            Cabang tempatmu bertugas
            <select aria-label="Cabang petugas" value={branchId} onChange={(e) => setBranchId(e.target.value)} className={fieldInput}>
              {cabang.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          {bisaKamera ? (
            <div className="mb-2">
              {scanning ? (
                <button type="button" onClick={stop} className={cn(tombolKecil, "bg-kongsi-parchment-3 px-3 py-2 text-sm")}>
                  Tutup kamera
                </button>
              ) : (
                <button type="button" onClick={mulaiKamera} className={cn(tombolKecil, "w-full bg-kongsi-beeswax px-3 py-2 text-sm")}>
                  📷 Pindai QR Surat Jalan
                </button>
              )}
              <video ref={videoRef} muted playsInline className={cn("mt-2 w-full rounded-[4px] border-2 border-kongsi-ink", !scanning && "hidden")} />
            </div>
          ) : null}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              tebus(kode);
            }}
          >
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="KODE-VOUCHER"
              maxLength={11}
              aria-label="Kode voucher"
              className={cn(fieldInput, "font-fraunces text-lg tracking-[3px]")}
            />
            <button type="submit" disabled={busy || kode.replace(/[^0-9A-Z]/g, "").length !== 10} className={cn(tombolKecil, "bg-kongsi-grenadine px-4 text-sm text-kongsi-parchment")}>
              {busy ? "…" : "Tebus"}
            </button>
          </form>
          {hasil ? (
            <p
              className={cn(
                "mt-2 rounded-[4px] border-2 px-3 py-2 text-[13px] font-semibold",
                hasil.ok ? "border-kongsi-ok bg-kongsi-sage/30 text-kongsi-ok" : "border-kongsi-grenadine bg-kongsi-parchment-3 text-kongsi-grenadine-dark",
              )}
            >
              {hasil.teks}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
