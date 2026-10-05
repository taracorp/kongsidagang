"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  terimaTukar,
  tolakTukar,
  tarikTukar,
  pindaiKode,
  batalDiTempat,
  ajukanSengketa,
  nilaiTukar,
} from "@/app/actions/tukar";
import { TITIK_AMAN } from "@/lib/domain/tukar-aturan";
import { cn } from "@/lib/utils";
import { KongsiButton } from "./KongsiButton";

const input =
  "w-full rounded-[3px] border-2 border-kongsi-ink bg-white px-3 py-[10px] font-work text-sm focus:outline-2 focus:outline-kongsi-beeswax";
const label = "mb-[5px] block text-[13px] font-bold";

function Pesan({ m }: { m: string | null }) {
  return m ? (
    <p className="mt-2 rounded-[4px] border-2 border-kongsi-grenadine bg-kongsi-parchment-3 px-3 py-2 text-[13px] text-kongsi-grenadine-dark">
      {m}
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

export function TerimaTawaran({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  const [type, setType] = useState<string>(TITIK_AMAN[0].key);
  const [place, setPlace] = useState("");
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
      <div className="mt-3 flex gap-3">
        <KongsiButton
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => jalankan(() => tolakTukar(dealId))}
        >
          Tolak
        </KongsiButton>
        <KongsiButton
          type="button"
          className="flex-1"
          disabled={busy}
          onClick={() => jalankan(() => terimaTukar(dealId, type, place))}
        >
          {busy ? "Memproses…" : "Terima & tahan bea"}
        </KongsiButton>
      </div>
      <Pesan m={err} />
    </div>
  );
}

export function TarikTawaran({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  return (
    <div>
      <KongsiButton type="button" variant="ghost" disabled={busy} onClick={() => jalankan(() => tarikTukar(dealId))}>
        Tarik tawaran (Keteng kembali)
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

export function BatalAtauSengketa({ dealId }: { dealId: string }) {
  const { busy, err, jalankan } = useAksi();
  const [mode, setMode] = useState<null | "batal" | "sengketa">(null);
  const [alasan, setAlasan] = useState("");
  if (!mode) {
    return (
      <div className="flex flex-wrap gap-3">
        <KongsiButton type="button" variant="ghost" onClick={() => setMode("batal")}>
          Batalkan di tempat
        </KongsiButton>
        <KongsiButton type="button" variant="ghost" className="text-kongsi-bad" onClick={() => setMode("sengketa")}>
          ⚖️ Ajukan ke Syahbandar
        </KongsiButton>
      </div>
    );
  }
  return (
    <div>
      <label className={label} htmlFor="alasan">
        {mode === "batal"
          ? "Kenapa dibatalkan? (bea & Keteng kembali ke kedua pihak)"
          : "Ceritakan masalahnya ke Syahbandar (rekber tetap ditahan sampai diputus)"}
      </label>
      <textarea
        id="alasan"
        rows={3}
        value={alasan}
        maxLength={300}
        onChange={(e) => setAlasan(e.target.value)}
        className={input}
        placeholder={mode === "batal" ? "cth. rangka retak, tidak sesuai checklist" : "cth. tidak datang, minta transfer di luar aplikasi"}
      />
      <div className="mt-3 flex gap-3">
        <KongsiButton type="button" variant="ghost" onClick={() => setMode(null)}>
          Kembali
        </KongsiButton>
        <KongsiButton
          type="button"
          className="flex-1"
          disabled={busy}
          onClick={() =>
            jalankan(() => (mode === "batal" ? batalDiTempat(dealId, alasan) : ajukanSengketa(dealId, alasan)))
          }
        >
          {busy ? "Memproses…" : mode === "batal" ? "Ya, batalkan" : "Kirim ke Syahbandar"}
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
