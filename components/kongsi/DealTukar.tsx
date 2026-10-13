"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  terimaTukar,
  tolakTukar,
  tarikTukar,
  pindaiKode,
  batalDiTempat,
  batalMenungguTukar,
  ajukanSengketa,
  nilaiTukar,
  bayarOngkirTukar,
  setorTukar,
  cobaKirimLagi,
  konfirmasiTerima,
} from "@/app/actions/tukar";
import { TITIK_AMAN } from "@/lib/domain/tukar-aturan";
import { saranIsi, tautanIsi } from "@/lib/pundi-paket";
import { cn, formatKeping } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";
import { BayarLangsung } from "./BayarLangsung";

const input =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[5px] block text-[13px] font-bold";
const pilihan =
  "cursor-pointer rounded-[6px] border-2 border-kongsi-ink px-3 py-2 text-left text-[13px] font-bold shadow-hard-sm transition-transform hover:translate-x-[1px] hover:translate-y-[1px]";

/** Pesan galat; bila saldo kurang, sertakan tautan Isi Pundi dengan nominal kekurangan. */
function Pesan({ m, kurang, tanpaIsi }: { m: string | null; kurang?: number; tanpaIsi?: boolean }) {
  return m ? (
    <p className="mt-2 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
      {m}
      {/saldo/i.test(m) && !tanpaIsi ? (
        <>
          {" "}
          <a href={tautanIsi(kurang ?? 0)} className="font-bold underline">
            Isi Pundi{kurang ? ` ${formatKeping(saranIsi(kurang))}` : ""}
          </a>
        </>
      ) : null}
      {/rekening/i.test(m) ? (
        <>
          {" "}
          <a href="/pakhuis/rekening" className="font-bold underline">
            Isi rekening
          </a>
        </>
      ) : null}
    </p>
  ) : null;
}

/** Jalankan aksi server, tampilkan error, refresh bila sukses. */
function useAksi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function jalankan(f: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setErr(null);
    const { error } = await f();
    setBusy(false);
    if (error) setErr(error);
    else router.refresh();
  }
  return { busy, err, jalankan };
}

export type AlamatPilihan = { id: string; label: string; area: string };

export function TerimaTawaran({
  dealId,
  mode,
  alamat = [],
  kurang = 0,
  saldo = 0,
  kebutuhan = null,
  langsung = false,
}: {
  dealId: string;
  mode: "cod" | "kirim";
  alamat?: AlamatPilihan[];
  kurang?: number; // kekurangan saldo untuk jaminan saat menerima (perkiraan)
  saldo?: number;
  kebutuhan?: number | null; // Keteng jaminan saat menerima (null = ada ongkir yang belum diketahui)
  langsung?: boolean; // Bayar Langsung (DOKU) tersedia
}) {
  const { busy, err, jalankan } = useAksi();
  const [type, setType] = useState<string>(TITIK_AMAN[0].key);
  const [place, setPlace] = useState("");
  const [addressId, setAddressId] = useState(alamat[0]?.id ?? "");

  // Saldo kurang (perkiraan, atau ditolak server karena ongkir) → bayar langsung, terima dijalankan setelah lunas.
  const pakaiLangsung = langsung && (kurang > 0 || /saldo/i.test(err ?? ""));
  const muatan = mode === "kirim" ? { dealId, addressId } : { dealId, meetType: type, meetPlace: place };
  const tombol = pakaiLangsung ? (
    <div className="mt-3 space-y-2">
      <BayarLangsung
        tujuan="tukar_terima"
        muatan={muatan}
        kebutuhan={kebutuhan}
        saldo={saldo}
        disabled={busy || (mode === "kirim" && !addressId)}
      />
      <KongsiButton type="button" variant="ghost" block disabled={busy} onClick={() => jalankan(() => tolakTukar(dealId))}>
        Tolak
      </KongsiButton>
    </div>
  ) : (
    <div className="mt-3 flex gap-3">
      <KongsiButton type="button" variant="ghost" disabled={busy} onClick={() => jalankan(() => tolakTukar(dealId))}>
        Tolak
      </KongsiButton>
      <KongsiButton
        type="button"
        className="flex-1"
        disabled={busy || (mode === "kirim" && !addressId)}
        onClick={() =>
          jalankan(() => terimaTukar(dealId, mode === "kirim" ? { addressId } : { meetType: type, meetPlace: place }))
        }
      >
        {busy ? "Memproses…" : "Terima & tahan jaminan"}
      </KongsiButton>
    </div>
  );

  if (mode === "kirim") {
    return (
      <div>
        <label className={label} htmlFor="address_b">
          Kirim barang ke alamatku
        </label>
        {alamat.length ? (
          <select id="address_b" value={addressId} onChange={(e) => setAddressId(e.target.value)} className={input}>
            {alamat.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.area}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-[13px] text-kongsi-ink-soft">Belum ada alamat.</p>
        )}
        <a href="/pakhuis/alamat" className="mt-1 inline-block text-[12px] font-bold text-kongsi-grenadine">
          + Tambah / kelola alamat
        </a>
        <p className="mt-2 text-[12px] text-kongsi-ink-soft">
          Ongkir dihitung otomatis (kurir termurah + asuransi). Kamu membayar ongkir barang yang <b>kamu terima</b>,
          plus deposit (kembali saat selesai).
        </p>
        {tombol}
        <Pesan m={err} kurang={kurang} tanpaIsi={langsung} />
      </div>
    );
  }

  return (
    <div>
      <label className={label} htmlFor="meet_type">
        Titik Aman ketemuan
      </label>
      <select id="meet_type" value={type} onChange={(e) => setType(e.target.value)} className={input}>
        {TITIK_AMAN.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <label className={cn(label, "mt-3")} htmlFor="meet_place">
        Nama tempatnya
      </label>
      <input
        id="meet_place"
        value={place}
        maxLength={80}
        onChange={(e) => setPlace(e.target.value)}
        className={input}
        placeholder="cth. Indomaret Jl. Kaliurang km 5"
      />
      <p className="mt-1 text-[11px] text-kongsi-ink-soft">
        Tempat umum, terang, ramai / ber-CCTV. Jangan ketemuan di rumah.
      </p>
      {tombol}
      <Pesan m={err} kurang={kurang} tanpaIsi={langsung} />
    </div>
  );
}

/**
 * Setor setelah tawaran diterima: jaminan Keteng (dari saldo atau dibeli) + selisih uang lewat QRIS/VA bila aku
 * pembayarnya. Selisih tidak pernah dibayar dengan Keteng.
 */
export function SetorTukar({
  dealId,
  keteng,
  uang,
  saldo,
  langsung,
}: {
  dealId: string;
  keteng: number;
  uang: number;
  saldo: number;
  langsung: boolean;
}) {
  const { busy, err, jalankan } = useAksi();
  if (uang > 0 || keteng > saldo) {
    if (!langsung) return <Pesan m="Pembayaran DOKU belum tersedia. Hubungi Kongsi." />;
    return <BayarLangsung tujuan="tukar_setor" muatan={{ dealId }} kebutuhan={keteng} uang={uang} saldo={saldo} />;
  }
  return (
    <div>
      <KongsiButton type="button" block disabled={busy} onClick={() => jalankan(() => setorTukar(dealId))}>
        {busy ? "Memproses…" : `Tahan jaminan ${formatKeping(keteng)} dari Pundi`}
      </KongsiButton>
      <Pesan m={err} kurang={Math.max(0, keteng - saldo)} />
    </div>
  );
}

/** Mundur saat menunggu pembayaran: yang mundur = penyebab batal (bea hangus + catatan pelanggaran). */
export function BatalMenunggu({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  const [buka, setBuka] = useState(false);
  const [alasan, setAlasan] = useState("");
  if (!buka) {
    return (
      <KongsiButton type="button" variant="ghost" onClick={() => setBuka(true)}>
        Mundur dari tukar ini
      </KongsiButton>
    );
  }
  return (
    <div>
      <p className="mb-2 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px]">
        Mundur setelah tawaran diterima = kamu penyebab batal: <b>bea-mu hangus</b> (bila sudah ditahan) dan tercatat
        sebagai pelanggaran. Jaminan lain kembali.
      </p>
      <label className={label} htmlFor="alasan-mundur">
        Alasan
      </label>
      <input id="alasan-mundur" value={alasan} maxLength={200} onChange={(e) => setAlasan(e.target.value)} className={input} />
      <div className="mt-3 flex gap-3">
        <KongsiButton type="button" variant="ghost" onClick={() => setBuka(false)}>
          Kembali
        </KongsiButton>
        <KongsiButton type="button" className="flex-1" disabled={busy} onClick={() => jalankan(() => batalMenungguTukar(dealId, alasan))}>
          {busy ? "Memproses…" : "Ya, mundur"}
        </KongsiButton>
      </div>
      <Pesan m={err} />
    </div>
  );
}

/** Alur lama (v2): lunasi ongkir paket yang akan diterima. */
export function BayarOngkir({
  dealId,
  amount,
  kurang = 0,
}: {
  dealId: string;
  amount: number;
  kurang?: number;
}) {
  const { busy, err, jalankan } = useAksi();
  return (
    <div>
      <KongsiButton type="button" block disabled={busy} onClick={() => jalankan(() => bayarOngkirTukar(dealId))}>
        {busy ? "Memproses…" : `Bayar ongkir ${formatKeping(amount)} dari Pundi`}
      </KongsiButton>
      <Pesan m={err} kurang={kurang} />
    </div>
  );
}

export function CobaKirimLagi({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  return (
    <div>
      <KongsiButton type="button" variant="gold" disabled={busy} onClick={() => jalankan(() => cobaKirimLagi(dealId))}>
        {busy ? "Menghubungi kurir…" : "Coba buat order kurir lagi"}
      </KongsiButton>
      <Pesan m={err} />
    </div>
  );
}

export function KonfirmasiTerima({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  return (
    <div>
      <KongsiButton type="button" block disabled={busy} onClick={() => jalankan(() => konfirmasiTerima(dealId))}>
        {busy ? "Memproses…" : "Barang sudah kuterima & sesuai"}
      </KongsiButton>
      <Pesan m={err} />
    </div>
  );
}

export function TarikTawaran({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  return (
    <div>
      <KongsiButton type="button" variant="ghost" disabled={busy} onClick={() => jalankan(() => tarikTukar(dealId))}>
        Tarik tawaran
      </KongsiButton>
      <Pesan m={err} />
    </div>
  );
}

const tanpaLangganan = () => () => {};

// BarcodeDetector belum ada di lib.dom TypeScript.
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

export function PindaiKode({ dealId }: { dealId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [kode, setKode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
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

  async function kirim(v: string) {
    setBusy(true);
    setErr(null);
    const { error } = await pindaiKode(dealId, v);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setKode("");
    router.refresh();
  }

  async function mulaiKamera() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
      const det = new Ctor({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current) return;
        const found = await det.detect(video).catch(() => []);
        if (found[0]?.rawValue) {
          stop();
          await kirim(found[0].rawValue);
          return;
        }
        setTimeout(loop, 400);
      };
      loop();
    } catch {
      stop();
      setErr("Kamera tidak bisa dibuka. Ketik 6 angka kodenya saja.");
    }
  }

  return (
    <div>
      {bisaKamera ? (
        <div className="mb-3">
          {scanning ? (
            <KongsiButton type="button" variant="ghost" onClick={stop}>
              Tutup kamera
            </KongsiButton>
          ) : (
            <KongsiButton type="button" variant="gold" block onClick={mulaiKamera}>
              📷 Pindai QR milik lawan
            </KongsiButton>
          )}
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn("mt-2 w-full rounded-[4px] border-2 border-kongsi-ink", !scanning && "hidden")}
          />
        </div>
      ) : null}
      <label className={label} htmlFor="kode">
        …atau ketik 6 angka kode milik lawan
      </label>
      <div className="flex gap-2">
        <input
          id="kode"
          inputMode="numeric"
          maxLength={6}
          value={kode}
          onChange={(e) => setKode(e.target.value.replace(/\D/g, ""))}
          className={cn(input, "font-fraunces text-xl tracking-[6px]")}
          placeholder="••••••"
        />
        <KongsiButton type="button" disabled={busy || kode.length !== 6} onClick={() => kirim(kode)}>
          {busy ? "…" : "Cocokkan"}
        </KongsiButton>
      </div>
      <Pesan m={err} />
    </div>
  );
}

/**
 * Batal (COD sebelum ada pindaian / Kirim sebelum paket dibuat) atau ajukan ke Syahbandar (alasan + foto bukti).
 * COD: "barang lawan tidak sesuai" → semua kembali, lawan dicatat; alasan lain → bea-mu hangus + catatan pelanggaran.
 */
export function BatalAtauSengketa({
  dealId,
  mode = "cod",
  bolehBatal = true,
  labelBatal = "Batalkan di tempat",
}: {
  dealId: string;
  mode?: "cod" | "kirim";
  bolehBatal?: boolean;
  labelBatal?: string;
}) {
  const { busy, err, jalankan } = useAksi();
  const [aksi, setAksi] = useState<null | "batal" | "sengketa">(null);
  const [tidakSesuai, setTidakSesuai] = useState(mode === "cod");
  const [alasan, setAlasan] = useState("");
  const [bukti, setBukti] = useState<File | null>(null);

  if (!aksi) {
    return (
      <div className="flex flex-wrap gap-3">
        {bolehBatal ? (
          <KongsiButton type="button" variant="ghost" onClick={() => setAksi("batal")}>
            {labelBatal}
          </KongsiButton>
        ) : null}
        <KongsiButton type="button" variant="ghost" className="text-kongsi-bad" onClick={() => setAksi("sengketa")}>
          ⚖️ Ajukan ke Syahbandar
        </KongsiButton>
      </div>
    );
  }

  function kirimSengketa() {
    const f = new FormData();
    f.set("dealId", dealId);
    f.set("alasan", alasan);
    if (bukti) f.set("bukti", bukti);
    return ajukanSengketa(f);
  }

  return (
    <div>
      {aksi === "batal" && mode === "cod" ? (
        <div className="mb-3 grid gap-2">
          {[
            { v: true, l: "Barang lawan tidak sesuai foto/keterangan", d: "Semua jaminan kembali; lawan dicatat sebagai penyebab." },
            { v: false, l: "Alasan lain / berubah pikiran", d: "Bea-mu hangus dan dicatat sebagai pelanggaran." },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              aria-pressed={tidakSesuai === o.v}
              onClick={() => setTidakSesuai(o.v)}
              className={cn(pilihan, tidakSesuai === o.v ? "bg-kongsi-grenadine text-kongsi-parchment" : "bg-kongsi-parchment hover:bg-kongsi-beeswax")}
            >
              {o.l}
              <span className={cn("block text-[11px] font-normal", tidakSesuai === o.v ? "text-kongsi-parchment" : "text-kongsi-ink-soft")}>{o.d}</span>
            </button>
          ))}
        </div>
      ) : null}
      {aksi === "batal" && mode === "kirim" ? (
        <p className="mb-2 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[12px]">
          Membatalkan sebelum dikirim = kamu penyebab batal: bea-mu hangus dan dicatat sebagai pelanggaran.
        </p>
      ) : null}
      <label className={label} htmlFor="alasan">
        {aksi === "batal" ? "Ceritakan alasannya" : "Ceritakan masalahnya ke Syahbandar (jaminan & selisih tetap ditahan sampai diputus)"}
      </label>
      <textarea
        id="alasan"
        rows={3}
        value={alasan}
        maxLength={500}
        onChange={(e) => setAlasan(e.target.value)}
        className={input}
        placeholder={aksi === "batal" ? "cth. rangka retak, tidak sesuai checklist" : "cth. tidak datang, minta transfer di luar aplikasi"}
      />
      {aksi === "sengketa" ? (
        <div className="mt-2">
          <label className={label} htmlFor="bukti">
            Foto bukti <span className="text-kongsi-grenadine">*wajib</span>
          </label>
          <input
            id="bukti"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setBukti(e.target.files?.[0] ?? null)}
            className="block w-full text-[13px]"
          />
          <p className="mt-1 text-[11px] text-kongsi-ink-soft">Foto barang, tempat ketemu, atau tangkapan layar percakapan. Maks 5 MB.</p>
        </div>
      ) : null}
      <div className="mt-3 flex gap-3">
        <KongsiButton type="button" variant="ghost" onClick={() => setAksi(null)}>
          Kembali
        </KongsiButton>
        <KongsiButton
          type="button"
          className="flex-1"
          disabled={busy || (aksi === "sengketa" && (!bukti || alasan.trim().length < 10))}
          onClick={() => jalankan(() => (aksi === "batal" ? batalDiTempat(dealId, alasan, mode === "cod" && tidakSesuai) : kirimSengketa()))}
        >
          {busy ? "Memproses…" : aksi === "batal" ? "Ya, batalkan" : "Kirim ke Syahbandar"}
        </KongsiButton>
      </div>
      <Pesan m={err} />
    </div>
  );
}

export function NilaiTukar({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStars(s)}
            aria-label={`${s} bintang`}
            className="cursor-pointer text-[28px] leading-none text-kongsi-beeswax-dark"
          >
            {s <= stars ? "★" : "☆"}
          </button>
        ))}
      </div>
      <input
        value={comment}
        maxLength={200}
        onChange={(e) => setComment(e.target.value)}
        className={cn(input, "mt-2")}
        placeholder="Komentar singkat (opsional)"
      />
      <KongsiButton
        type="button"
        className="mt-3"
        disabled={busy || stars === 0}
        onClick={() => jalankan(() => nilaiTukar(dealId, stars, comment.trim() || undefined))}
      >
        Kirim penilaian
      </KongsiButton>
      <Pesan m={err} />
    </div>
  );
}

export function HitungMundur({ until }: { until: string }) {
  // Detak tiap 30 detik; server merender kosong (hindari beda jam saat hidrasi).
  const now = useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, 30_000);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / 30_000) * 30_000,
    () => null,
  );
  if (now === null) return null;
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <span>waktu habis</span>;
  const j = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return (
    <span>
      {j} jam {m} menit lagi
    </span>
  );
}
