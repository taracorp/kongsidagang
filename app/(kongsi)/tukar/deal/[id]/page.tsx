import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Pill } from "@/components/kongsi/Pill";
import {
  TerimaTawaran,
  TarikTawaran,
  PindaiKode,
  BatalAtauSengketa,
  NilaiTukar,
  HitungMundur,
  BayarOngkir,
  CobaKirimLagi,
  KonfirmasiTerima,
} from "@/components/kongsi/DealTukar";
import { getSessionUser } from "@/lib/auth";
import { getDealDetail, type DealBarang, type DealPaket } from "@/lib/queries";
import { kodeKetemu } from "@/lib/domain/tukar";
import { alamatSaya } from "@/lib/domain/alamat";
import { labelStatus, titikAmanLabel } from "@/lib/domain/tukar-aturan";
import { formatKeping } from "@/lib/utils";

// Warna QR = token ink & parchment-3 (SVG butuh nilai literal).
const QR_WARNA = { dark: "#3A2417", light: "#FBEDD2" };

const statusPill: Record<string, "gold" | "sage" | "indigo" | "live"> = {
  proposed: "gold",
  agreed: "live",
  dikirim: "live",
  diterima: "gold",
  done: "sage",
  resolved: "sage",
  disputed: "live",
};

const statusPaket: Record<string, string> = {
  quoted: "belum dibayar",
  paid: "ongkir lunas",
  requested: "order dibuat",
  shipped: "dibawa kurir",
  delivered: "sampai",
  canceled: "dibatalkan",
  returned: "diretur",
  problem: "bermasalah",
  failed: "gagal dibuat",
};

const kartu = "rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard";
const judul = "mb-3 font-fraunces text-lg font-black text-kongsi-indigo";

const LABEL_AKURASI: Record<string, string> = {
  tinggi: "akurasi tinggi",
  sedang: "akurasi sedang",
  rendah: "akurasi rendah",
  ditera: "ditera Penaksir",
};

/** Dasar taksiran (pembanding pasar) — bisa dibuka kedua pihak. */
function DasarTaksiran({ b }: { b: DealBarang }) {
  return (
    <details className="mb-1 text-[12px]">
      <summary className="cursor-pointer font-bold text-kongsi-grenadine">
        Dasar taksiran {b.title}: {LABEL_AKURASI[b.accuracy ?? ""] ?? "taksiran lama"}
        {b.pembanding.length ? ` · ${b.pembanding.length} pembanding` : ""}
      </summary>
      {b.pembanding.length ? (
        <ul className="mt-1 space-y-[2px] pl-3">
          {b.pembanding.map((p) => (
            <li key={p.url} className="flex justify-between gap-2">
              <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 flex-1 truncate underline">
                {p.sumber} · {p.kondisi} · {p.judul}
              </a>
              <b>{formatKeping(p.harga)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 pl-3 text-kongsi-ink-soft">Tanpa pembanding pasar — nilai dari harga beli / Penaksir.</p>
      )}
    </details>
  );
}

function KartuPaket({ p, mine, theirs }: { p: DealPaket; mine: string; theirs: string }) {
  return (
    <div className="rounded-[4px] border-[1.5px] border-kongsi-ink/30 bg-kongsi-parchment-3 p-3 text-[13px]">
      <div className="flex items-center justify-between gap-2">
        <b>{p.iReceive ? `${theirs} → aku` : `${mine} → dia`}</b>
        <Pill variant={p.status === "delivered" ? "sage" : ["problem", "failed", "canceled", "returned"].includes(p.status) ? "live" : "gold"}>
          {statusPaket[p.status] ?? p.status}
        </Pill>
      </div>
      <div className="mt-1 text-kongsi-ink-soft">
        {p.serviceName}
        {p.etd ? ` · ${p.etd} hari` : ""} · ongkir {formatKeping(p.ongkir)}
        {p.iReceive ? " (aku bayar)" : " (dia bayar)"}
      </div>
      {p.awb ? <div className="mt-1">Resi: <b className="font-fraunces tracking-[1px]">{p.awb}</b></div> : null}
      {p.statusText ? <div className="mt-1 text-[12px]">{p.statusText}</div> : null}
    </div>
  );
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const d = await getDealDetail(id, user.id);
  if (!d) notFound();

  const kirim = d.mode === "kirim";
  const myCode = !kirim && d.status === "agreed" && d.agreedAt ? kodeKetemu(d.id, d.me, d.agreedAt) : null;
  const qrSvg = myCode
    ? await QRCode.toString(`KDT:${d.id}:${myCode}`, { type: "svg", margin: 1, color: QR_WARNA })
    : null;
  const alamat = kirim && d.status === "proposed" && d.me === "b" ? await alamatSaya(user.id) : [];
  const paketKu = d.paket.find((p) => p.iReceive);
  const adaGagal = d.paket.some((p) => p.status === "failed");
  const ditahanAwal = d.myFee + (d.iPayTopup ? d.topup : 0) + d.myDeposit;
  const row = "flex justify-between gap-3 py-[3px]";

  return (
    <section className="py-[34px]">
      <div className="mx-auto max-w-[720px] space-y-5 px-5">
        <div className="text-center">
          <div className="font-fraunces text-base font-semibold italic text-kongsi-grenadine">
            Tukar Guling · {kirim ? "Kirim kurir" : "COD"}
          </div>
          <h2 className="mt-1 font-fraunces text-[28px] font-black leading-tight text-kongsi-indigo">
            {d.mine.title} ⇄ {d.theirs.title}
          </h2>
          <div className="mt-2">
            <Pill variant={statusPill[d.status] ?? "indigo"}>{labelStatus(d.status)}</Pill>
          </div>
        </div>

        {/* Ringkasan nilai & rekber */}
        <div className={kartu}>
          <h3 className={judul}>Neraca tukar</h3>
          <div className="text-[14px]">
            <div className={row}>
              <span>Barangku · {d.mine.title}</span>
              <b>{formatKeping(d.mine.value)}</b>
            </div>
            <div className={row}>
              <span>Barang {d.counterparty.name} · {d.theirs.title}</span>
              <b>{formatKeping(d.theirs.value)}</b>
            </div>
            {d.topup > 0 ? (
              <div className={row}>
                <span>{d.iPayTopup ? "Aku menambah" : `${d.counterparty.name} menambah`}</span>
                <b className="text-kongsi-grenadine">{formatKeping(d.topup)}</b>
              </div>
            ) : null}
            <div className="mt-2">
              <DasarTaksiran b={d.mine} />
              <DasarTaksiran b={d.theirs} />
            </div>
            <div className="my-2 border-t-[1.5px] border-dashed border-kongsi-ink/25" />
            <div className={row}>
              <span>Bea Tukar-ku</span>
              <b>{formatKeping(d.myFee)}</b>
            </div>
            {d.myDeposit > 0 ? (
              <div className={row}>
                <span>Deposit Kirim-ku (kembali saat selesai)</span>
                <b>{formatKeping(d.myDeposit)}</b>
              </div>
            ) : null}
            {paketKu ? (
              <div className={row}>
                <span>Ongkir barang yang kuterima</span>
                <b>{formatKeping(paketKu.ongkir)}</b>
              </div>
            ) : null}
            <div className={`${row} font-bold`}>
              <span>Keteng-ku yang ditahan / dipakai</span>
              <span>{formatKeping(ditahanAwal + (paketKu && paketKu.status !== "quoted" ? paketKu.ongkir : 0))}</span>
            </div>
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">
              {kirim
                ? "Bea diambil & deposit kembali setelah kedua paket sampai dan dikonfirmasi. Batal sebelum paket dibuat → semua kembali."
                : "Rekber dilepas saat kedua pihak saling memindai kode di Titik Aman. Batal / kedaluwarsa → kembali utuh."}
            </p>
          </div>
        </div>

        {d.status === "proposed" ? (
          <div className={kartu}>
            {d.me === "b" ? (
              <>
                <h3 className={judul}>{d.counterparty.name} mengajak tukar</h3>
                <p className="mb-3 text-[13px] text-kongsi-ink-soft">
                  Terima = bea Tukar-mu ({formatKeping(d.myFee)})
                  {d.iPayTopup ? ` + tambahan ${formatKeping(d.topup)}` : ""}
                  {d.myDeposit ? ` + deposit ${formatKeping(d.myDeposit)}` : ""} ditahan
                  {kirim ? ", plus ongkir barang yang kamu terima." : ", lalu atur ketemuan."}
                </p>
                <TerimaTawaran
                  dealId={d.id}
                  mode={d.mode}
                  alamat={alamat.map((a) => ({ id: a.id, label: a.label, area: a.area }))}
                />
              </>
            ) : (
              <>
                <h3 className={judul}>Menunggu jawaban {d.counterparty.name}</h3>
                {d.expiresAt ? (
                  <p className="mb-3 text-[13px] text-kongsi-ink-soft">
                    Kedaluwarsa otomatis: <HitungMundur until={d.expiresAt} />
                  </p>
                ) : null}
                <TarikTawaran dealId={d.id} />
              </>
            )}
          </div>
        ) : null}

        {/* ---------- COD ---------- */}
        {!kirim && d.status === "agreed" ? (
          <>
            <div className={kartu}>
              <h3 className={judul}>Ketemuan di Titik Aman</h3>
              <div className="text-[14px]">
                <div className="font-bold">{d.meetPlace}</div>
                <div className="text-[12px] text-kongsi-ink-soft">{titikAmanLabel(d.meetType)}</div>
                <div className="mt-2 text-[13px]">
                  Kontak {d.counterparty.name}: <b>{d.counterparty.email}</b>
                </div>
                {d.expiresAt ? (
                  <div className="mt-2 font-fraunces text-xl font-black text-kongsi-grenadine">
                    <HitungMundur until={d.expiresAt} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className={kartu}>
              <h3 className={judul}>1. Tunjukkan kodemu</h3>
              {d.myCodeScanned ? (
                <p className="font-bold text-kongsi-ok">✓ Kodemu sudah dipindai {d.counterparty.name}.</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-[220px] overflow-hidden rounded-[4px] border-2 border-kongsi-ink"
                    // SVG dari pustaka qrcode (isi buatan server sendiri, bukan input user).
                    dangerouslySetInnerHTML={{ __html: qrSvg ?? "" }}
                  />
                  <div className="font-fraunces text-[34px] font-black tracking-[8px] text-kongsi-indigo">{myCode}</div>
                  <p className="text-center text-[12px] text-kongsi-ink-soft">
                    Tunjukkan setelah kamu puas memeriksa barang {d.counterparty.name}. Jangan kirim kode lewat chat.
                  </p>
                </div>
              )}
            </div>

            <div className={kartu}>
              <h3 className={judul}>2. Pindai kode {d.counterparty.name}</h3>
              {d.theirCodeScanned ? (
                <p className="font-bold text-kongsi-ok">✓ Kode {d.counterparty.name} sudah cocok.</p>
              ) : (
                <PindaiKode dealId={d.id} />
              )}
            </div>

            <div className={kartu}>
              <h3 className={judul}>Ada masalah?</h3>
              <BatalAtauSengketa dealId={d.id} />
            </div>
          </>
        ) : null}

        {/* ---------- Kirim ---------- */}
        {kirim && ["agreed", "dikirim", "diterima"].includes(d.status) ? (
          <div className={kartu}>
            <h3 className={judul}>Pengiriman</h3>
            <div className="space-y-3">
              {d.paket.map((p) => (
                <KartuPaket key={p.leg} p={p} mine={d.mine.title} theirs={d.theirs.title} />
              ))}
            </div>
            <div className="mt-3 text-[13px]">
              Kontak {d.counterparty.name}: <b>{d.counterparty.email}</b>
            </div>

            {d.status === "agreed" ? (
              <div className="mt-4 space-y-3">
                {paketKu?.status === "quoted" ? (
                  <>
                    <p className="text-[13px]">
                      Lunasi ongkir barang yang kamu terima agar kedua paket bisa dijemput kurir.
                      {d.expiresAt ? (
                        <>
                          {" "}
                          Batas: <b><HitungMundur until={d.expiresAt} /></b>
                        </>
                      ) : null}
                    </p>
                    <BayarOngkir dealId={d.id} amount={paketKu.ongkir} />
                  </>
                ) : adaGagal ? (
                  <>
                    <p className="text-[13px] text-kongsi-bad">Order kurir gagal dibuat. Keteng-mu aman di rekber.</p>
                    <CobaKirimLagi dealId={d.id} />
                  </>
                ) : (
                  <p className="text-[13px] text-kongsi-ink-soft">
                    Menunggu {d.counterparty.name} melunasi ongkir
                    {d.expiresAt ? (
                      <>
                        {" "}
                        (<HitungMundur until={d.expiresAt} />)
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </div>
            ) : null}

            {d.status === "dikirim" ? (
              <p className="mt-4 text-[13px] text-kongsi-ink-soft">
                Siapkan & kemas barangmu — kurir menjemput sesuai jadwal. Bila satu pihak tidak menyerahkan paket
                2×24 jam setelah pihak lain mengirim, Syahbandar turun tangan.
              </p>
            ) : null}

            {d.status === "diterima" ? (
              <div className="mt-4 space-y-2">
                {d.myConfirmed ? (
                  <p className="font-bold text-kongsi-ok">✓ Kamu sudah mengonfirmasi. Menunggu {d.counterparty.name}.</p>
                ) : (
                  <>
                    <p className="text-[13px]">
                      Kedua paket sudah sampai. Periksa barangnya (rekam video unboxing!) lalu konfirmasi.
                    </p>
                    <KonfirmasiTerima dealId={d.id} />
                  </>
                )}
                {d.expiresAt ? (
                  <p className="text-[12px] text-kongsi-ink-soft">
                    Konfirmasi otomatis: <HitungMundur until={d.expiresAt} />
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {kirim && ["agreed", "dikirim", "diterima"].includes(d.status) ? (
          <div className={kartu}>
            <h3 className={judul}>Ada masalah?</h3>
            <BatalAtauSengketa
              dealId={d.id}
              bolehBatal={d.status === "agreed" && !d.hasCourierOrder}
              labelBatal="Batalkan sebelum dikirim"
            />
          </div>
        ) : null}

        {d.status === "done" || d.status === "resolved" ? (
          <div className={kartu}>
            <h3 className={judul}>{d.status === "done" ? "Tukar selesai 🎉" : "Diputus Syahbandar"}</h3>
            {d.reason && d.status === "resolved" ? <p className="mb-3 text-[13px]">{d.reason}</p> : null}
            {d.ratedByMe ? (
              <p className="font-bold text-kongsi-ok">✓ Kamu sudah menilai {d.counterparty.name}.</p>
            ) : (
              <>
                <p className="mb-2 text-[13px] text-kongsi-ink-soft">Beri nilai {d.counterparty.name}:</p>
                <NilaiTukar dealId={d.id} />
              </>
            )}
          </div>
        ) : null}

        {d.status === "disputed" ? (
          <div className={kartu}>
            <h3 className={judul}>⚖️ Menunggu Syahbandar</h3>
            <p className="text-[13px]">{d.reason}</p>
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">Rekber tetap ditahan sampai diputus.</p>
          </div>
        ) : null}

        {["rejected", "cancelled", "expired"].includes(d.status) ? (
          <div className={kartu}>
            <h3 className={judul}>Tawaran {labelStatus(d.status)}</h3>
            {d.reason ? <p className="text-[13px]">{d.reason}</p> : null}
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">Semua Keteng yang ditahan sudah kembali ke Pundi.</p>
          </div>
        ) : null}

        <p className="text-center text-[12px]">
          <Link href="/tukar" className="font-bold text-kongsi-grenadine">
            ← Kembali ke Tukar Guling
          </Link>
        </p>
      </div>
    </section>
  );
}
