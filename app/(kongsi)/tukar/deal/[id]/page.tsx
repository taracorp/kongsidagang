import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Pill } from "@/components/kongsi/Pill";
import { LacakPaket } from "@/components/kongsi/LacakPaket";
import {
  TerimaTawaran,
  TarikTawaran,
  PindaiKode,
  BatalAtauSengketa,
  BatalMenunggu,
  NilaiTukar,
  HitungMundur,
  BayarOngkir,
  SetorTukar,
  CobaKirimLagi,
  KonfirmasiTerima,
} from "@/components/kongsi/DealTukar";
import { getSessionUser } from "@/lib/auth";
import { getDealDetail, getWalletBalance, type DealBarang, type DealDetail, type DealPaket } from "@/lib/queries";
import { kodeKetemu } from "@/lib/domain/tukar";
import { alamatSaya } from "@/lib/domain/alamat";
import { HARI_KERJA_PENCAIRAN, JAM_BAYAR, labelStatus, titikAmanLabel } from "@/lib/domain/tukar-aturan";
import { formatKeping } from "@/lib/utils";
import { isiPundiTersedia } from "@/lib/domain/pundi";

// Warna QR = token ink & parchment-3 (SVG butuh nilai literal).
const QR_WARNA = { dark: "#3A2417", light: "#FBEDD2" };

const statusPill: Record<string, "gold" | "sage" | "indigo" | "live"> = {
  proposed: "gold",
  menunggu_bayar: "gold",
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
  perlu_cek: "memastikan ke kurir",
  perlu_batal: "pembatalan diproses kurir",
  batal_gagal: "tidak bisa dibatalkan (sudah dijemput)",
};

const LABEL_TRANSFER: Record<string, string> = {
  pencairan_selisih: "Selisih ke rekeningmu",
  refund_selisih: "Pengembalian selisih ke rekeningmu",
};

const kartu = "rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-5 shadow-hard";
const judul = "mb-3 font-fraunces text-lg font-black text-kongsi-indigo";
const row = "flex justify-between gap-3 py-[3px] [&>*:last-child]:whitespace-nowrap";

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
        <Pill variant={p.status === "delivered" ? "sage" : ["problem", "failed", "canceled", "returned", "perlu_batal", "batal_gagal"].includes(p.status) ? "live" : "gold"}>
          {statusPaket[p.status] ?? p.status}
        </Pill>
      </div>
      <div className="mt-1 text-kongsi-ink-soft">
        {p.serviceName}
        {p.etd ? ` · ${p.etd} hari` : ""} · ongkir {formatKeping(p.ongkir)}
        {p.iReceive ? " (aku bayar)" : " (dia bayar)"}
      </div>
      {p.awb ? (
        <div className="mt-1">
          Resi: <b className="font-fraunces tracking-[1px]">{p.awb}</b>
          {p.sortingCode ? <span className="text-kongsi-ink-soft"> · sorting {p.sortingCode}</span> : null}
        </div>
      ) : null}
      {p.statusText ? <div className="mt-1 text-[12px]">{p.statusText}</div> : null}
      {p.orderId ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
          {!p.iReceive && p.awb ? (
            <a href={`/label/tukar/${p.id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-kongsi-grenadine">
              Cetak label pengiriman ↗
            </a>
          ) : null}
          <LacakPaket shipmentId={p.id} />
        </div>
      ) : null}
    </div>
  );
}

/** Status uang selisih & transfer untuk pihak ini. */
function InfoSelisih({ d }: { d: DealDetail }) {
  if (!d.selisih) return null;
  const ket =
    d.selisihStatus === "ditahan"
      ? "Ditahan Kongsi sampai tukar selesai."
      : d.selisihStatus === "dicairkan"
        ? `Diteruskan ke rekening penerima (paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja).`
        : d.selisihStatus === "dikembalikan"
          ? `Dikembalikan ke rekening pembayar (paling lambat ${HARI_KERJA_PENCAIRAN} hari kerja).`
          : "Belum dibayar.";
  return (
    <div className="mt-2 rounded-[4px] border-[1.5px] border-dashed border-kongsi-ink/30 bg-kongsi-parchment-3 p-2 text-[12px]">
      <b>Selisih uang:</b> {ket}
      {d.transferKu.map((t, i) => (
        <div key={i} className="mt-1 flex justify-between gap-2">
          <span>{LABEL_TRANSFER[t.jenis] ?? t.jenis}</span>
          <b className={t.status === "dibayar" ? "text-kongsi-ok" : ""}>
            {formatKeping(t.nominal)} · {t.status === "dibayar" ? "sudah ditransfer ✓" : `paling lambat ${new Date(t.tenggat).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" })}`}
          </b>
        </div>
      ))}
      {(d.iPaySelisih || d.iReceiveSelisih) && !d.punyaRekening ? (
        <a href="/pakhuis/rekening" className="mt-1 block font-bold text-kongsi-grenadine underline">
          Isi rekening pencairan dulu →
        </a>
      ) : null}
    </div>
  );
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const [d, saldo] = await Promise.all([getDealDetail(id, user.id), getWalletBalance(user.id)]);
  if (!d) notFound();

  const kirim = d.mode === "kirim";
  const myCode = !kirim && d.status === "agreed" && d.agreedAt ? kodeKetemu(d.id, d.me, d.agreedAt) : null;
  const qrSvg = myCode
    ? await QRCode.toString(`KDT:${d.id}:${myCode}`, { type: "svg", margin: 1, color: QR_WARNA })
    : null;
  const alamat = kirim && d.status === "proposed" && d.me === "b" ? await alamatSaya(user.id) : [];
  const paketKu = d.paket.find((p) => p.iReceive);
  const adaGagal = d.paket.some((p) => p.status === "failed");
  const langsung = isiPundiTersedia() !== null;
  const lawan = d.counterparty.name;
  const sebelumBayar = d.status === "proposed" || d.status === "menunggu_bayar";

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

        {/* Ringkasan nilai, selisih & jaminan */}
        <div className={kartu}>
          <h3 className={judul}>Neraca tukar</h3>
          <div className="text-[14px]">
            <div className={row}>
              <span>Barangku · {d.mine.title}</span>
              <b>{formatKeping(d.mine.value)}</b>
            </div>
            <div className={row}>
              <span>Barang {lawan} · {d.theirs.title}</span>
              <b>{formatKeping(d.theirs.value)}</b>
            </div>
            {d.selisih > 0 ? (
              <div className={row}>
                <span>{d.iPaySelisih ? "Aku membayar selisih (uang)" : `${lawan} membayar selisih (uang)`}</span>
                <b className="text-kongsi-grenadine">{formatKeping(d.selisih)}</b>
              </div>
            ) : d.topup > 0 ? (
              <div className={row}>
                <span>{d.iPayTopup ? "Aku menambah Keteng" : `${lawan} menambah Keteng`}</span>
                <b className="text-kongsi-grenadine">{formatKeping(d.topup)}</b>
              </div>
            ) : null}
            {d.iPaySelisih ? (
              <div className={`${row} text-[13px] text-kongsi-ink-soft`}>
                <span>Biaya transfer pencairan ke {lawan}</span>
                <span>{formatKeping(d.biayaTransfer)}</span>
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
            {d.iReceiveSelisih && d.cadangan > 0 ? (
              <div className={row}>
                <span>Cadangan biaya pengembalian dana (kembali bila tukar jadi)</span>
                <b>{formatKeping(d.cadangan)}</b>
              </div>
            ) : null}
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
              <span>{sebelumBayar && d.ditahanKu === 0 ? "Jaminan Keteng-ku (perkiraan)" : "Keteng-ku yang ditahan sekarang"}</span>
              <span>{formatKeping(sebelumBayar && d.ditahanKu === 0 ? d.jaminanKu : d.ditahanKu)}</span>
            </div>
            <InfoSelisih d={d} />
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">
              Keteng hanya untuk jaminan (bea, cadangan, deposit, ongkir); selisih nilai dibayar uang. Tukar jadi → bea
              diambil Kongsi, jaminan lain kembali. Batal → semua kembali, kecuali bea pihak penyebab batal.
            </p>
          </div>
        </div>

        {d.status === "proposed" ? (
          <div className={kartu}>
            {d.me === "b" ? (
              <>
                <h3 className={judul}>{lawan} mengajak tukar</h3>
                <ul className="mb-3 list-disc space-y-1 pl-5 text-[13px] text-kongsi-ink-soft">
                  <li>
                    Terima = jaminan Keteng-mu {formatKeping(d.jaminanKu)}
                    {kirim ? " + ongkir barang yang kamu terima" : ""} ditahan sekarang.
                  </li>
                  <li>
                    {lawan} lalu punya waktu {JAM_BAYAR} jam (tidak jatuh di jam tidur) untuk menyetor
                    {d.selisih > 0 && !d.iPaySelisih ? ` dan membayar selisih ${formatKeping(d.selisih)}` : ""}. Tidak
                    lunas → batal otomatis, jaminanmu kembali utuh.
                  </li>
                  {d.iPaySelisih ? (
                    <li>
                      Kamu membayar selisih {formatKeping(d.selisih)} + biaya transfer {formatKeping(d.biayaTransfer)} (QRIS/VA)
                      setelah {lawan} menahan jaminannya.
                    </li>
                  ) : null}
                </ul>
                <TerimaTawaran
                  dealId={d.id}
                  mode={d.mode}
                  kurang={Math.max(0, d.jaminanKu - saldo)}
                  saldo={saldo}
                  kebutuhan={kirim ? null : d.jaminanKu}
                  langsung={langsung}
                  alamat={alamat.map((a) => ({ id: a.id, label: a.label, area: a.area }))}
                />
              </>
            ) : (
              <>
                <h3 className={judul}>Menunggu jawaban {lawan}</h3>
                <p className="mb-3 text-[13px] text-kongsi-ink-soft">
                  Belum ada yang ditahan. Bila diterima, kamu punya waktu {JAM_BAYAR} jam untuk menahan jaminan{" "}
                  {formatKeping(d.jaminanKu)}
                  {kirim ? " + ongkir" : ""}
                  {d.iPaySelisih ? ` dan membayar selisih ${formatKeping(d.selisih)} + biaya transfer ${formatKeping(d.biayaTransfer)}` : ""}.
                  {d.expiresAt ? (
                    <>
                      {" "}
                      Kedaluwarsa otomatis: <HitungMundur until={d.expiresAt} />
                    </>
                  ) : null}
                </p>
                <TarikTawaran dealId={d.id} />
              </>
            )}
          </div>
        ) : null}

        {d.status === "menunggu_bayar" ? (
          <div className={kartu}>
            <h3 className={judul}>{d.setorKu ? "Selesaikan pembayaran" : `Menunggu ${lawan} membayar`}</h3>
            {d.expiresAt ? (
              <div className="mb-3 font-fraunces text-xl font-black text-kongsi-grenadine">
                <HitungMundur until={d.expiresAt} />
              </div>
            ) : null}
            {d.setorKu ? (
              <>
                <div className="mb-3 text-[13px]">
                  {d.setorKu.keteng > 0 ? (
                    <div className={row}>
                      <span>Jaminan Keteng (bea{d.iReceiveSelisih ? " + cadangan" : ""}{kirim ? " + deposit + ongkir" : ""})</span>
                      <b>{formatKeping(d.setorKu.keteng)}</b>
                    </div>
                  ) : null}
                  {d.setorKu.uang > 0 ? (
                    <div className={row}>
                      <span>Selisih + biaya transfer (uang, ditahan Kongsi)</span>
                      <b>{formatKeping(d.setorKu.uang)}</b>
                    </div>
                  ) : null}
                </div>
                <SetorTukar dealId={d.id} keteng={d.setorKu.keteng} uang={d.setorKu.uang} saldo={saldo} langsung={langsung} />
                <p className="mt-2 text-[12px] text-kongsi-ink-soft">
                  Lewat batas waktu = batal otomatis & dicatat sebagai pelanggaran (3 dalam 30 hari = tidak bisa ikut Tukar
                  Guling 30 hari).
                </p>
              </>
            ) : (
              <p className="text-[13px] text-kongsi-ink-soft">
                Jaminanmu sudah ditahan. Bila {lawan} tidak menyetor sebelum batas waktu, tukar batal otomatis dan jaminanmu
                kembali utuh.
              </p>
            )}
            <div className="mt-4">
              <BatalMenunggu dealId={d.id} />
            </div>
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
                  Kontak {lawan}: <b>{d.counterparty.email}</b>
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
                <p className="font-bold text-kongsi-ok">✓ Kodemu sudah dipindai {lawan}.</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-[220px] overflow-hidden rounded-[4px] border-2 border-kongsi-ink"
                    // SVG dari pustaka qrcode (isi buatan server sendiri, bukan input user).
                    dangerouslySetInnerHTML={{ __html: qrSvg ?? "" }}
                  />
                  <div className="font-fraunces text-[34px] font-black tracking-[8px] text-kongsi-indigo">{myCode}</div>
                  <p className="text-center text-[12px] text-kongsi-ink-soft">
                    Tunjukkan setelah kamu puas memeriksa barang {lawan}. Jangan kirim kode lewat chat.
                  </p>
                </div>
              )}
            </div>

            <div className={kartu}>
              <h3 className={judul}>2. Pindai kode {lawan}</h3>
              {d.theirCodeScanned ? <p className="font-bold text-kongsi-ok">✓ Kode {lawan} sudah cocok.</p> : <PindaiKode dealId={d.id} />}
            </div>

            <div className={kartu}>
              <h3 className={judul}>Ada masalah?</h3>
              <BatalAtauSengketa dealId={d.id} mode="cod" bolehBatal={!d.myCodeScanned && !d.theirCodeScanned} />
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
              Kontak {lawan}: <b>{d.counterparty.email}</b>
            </div>

            {d.status === "agreed" ? (
              <div className="mt-4 space-y-3">
                {d.versi < 3 && paketKu?.status === "quoted" ? (
                  <>
                    <p className="text-[13px]">Lunasi ongkir barang yang kamu terima agar kedua paket bisa dijemput kurir.</p>
                    <BayarOngkir dealId={d.id} amount={paketKu.ongkir} kurang={Math.max(0, paketKu.ongkir - saldo)} />
                  </>
                ) : adaGagal ? (
                  <>
                    <p className="text-[13px] text-kongsi-bad">Order kurir gagal dibuat. Jaminanmu aman di rekber.</p>
                    <CobaKirimLagi dealId={d.id} />
                  </>
                ) : (
                  <p className="text-[13px] text-kongsi-ink-soft">Order kurir sedang dibuat…</p>
                )}
              </div>
            ) : null}

            {d.status === "dikirim" ? (
              <p className="mt-4 text-[13px] text-kongsi-ink-soft">
                Siapkan & kemas barangmu — kurir menjemput sesuai jadwal. Bila satu pihak tidak menyerahkan paket 2×24 jam
                setelah pihak lain mengirim, Syahbandar turun tangan.
              </p>
            ) : null}

            {d.status === "diterima" ? (
              <div className="mt-4 space-y-2">
                {d.myConfirmed ? (
                  <p className="font-bold text-kongsi-ok">✓ Kamu sudah mengonfirmasi. Menunggu {lawan}.</p>
                ) : (
                  <>
                    <p className="text-[13px]">Kedua paket sudah sampai. Periksa barangnya (rekam video unboxing!) lalu konfirmasi.</p>
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
              mode="kirim"
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
              <p className="font-bold text-kongsi-ok">✓ Kamu sudah menilai {lawan}.</p>
            ) : (
              <>
                <p className="mb-2 text-[13px] text-kongsi-ink-soft">Beri nilai {lawan}:</p>
                <NilaiTukar dealId={d.id} />
              </>
            )}
          </div>
        ) : null}

        {d.status === "disputed" ? (
          <div className={kartu}>
            <h3 className={judul}>⚖️ Menunggu Syahbandar</h3>
            <p className="text-[13px]">{d.reason}</p>
            {d.buktiUrl ? (
              <a href={d.buktiUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] font-bold text-kongsi-grenadine">
                Lihat foto bukti ↗
              </a>
            ) : null}
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">Jaminan & selisih tetap ditahan sampai diputus.</p>
          </div>
        ) : null}

        {["rejected", "cancelled", "expired"].includes(d.status) ? (
          <div className={kartu}>
            <h3 className={judul}>Tawaran {labelStatus(d.status)}</h3>
            {d.reason ? <p className="text-[13px]">{d.reason}</p> : null}
            <p className="mt-2 text-[12px] text-kongsi-ink-soft">
              Jaminan Keteng yang ditahan sudah kembali ke Pundi
              {d.fault ? ` (bea pihak ${d.fault === d.me ? "kamu" : lawan} sebagai penyebab batal bisa hangus)` : ""}.
            </p>
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
