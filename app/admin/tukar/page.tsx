import { redirect } from "next/navigation";
import { DisputeResolve } from "@/components/admin/DisputeResolve";
import { HargaKomoditas } from "@/components/admin/HargaKomoditas";
import { CatatKlaim, PutusKlaim } from "@/components/admin/KlaimAsuransi";
import { daftarKlaimAdmin } from "@/lib/domain/klaim";
import { TeraPenaksir } from "@/components/admin/TeraPenaksir";
import { loadCategories } from "@/lib/domain/kategori";
import { getDisputedDeals, getTeraQueue } from "@/lib/queries";
import { getStaffSession, isAdminUp } from "@/lib/roles";
import { formatKeping } from "@/lib/utils";
import { HARI_ESKALASI } from "@/lib/domain/tukar-aturan";

export default async function AdminTukar() {
  const { role } = await getStaffSession();
  if (!isAdminUp(role)) redirect("/admin");
  const [disputes, categories, tera, klaim] = await Promise.all([getDisputedDeals(), loadCategories(), getTeraQueue(), daftarKlaimAdmin()]);
  const komoditas = categories
    .filter((c) => c.kind === "komoditas")
    .map((c) => ({ slug: c.slug, name: c.name, unit: c.unit, price: c.price_per_unit }));

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-kongsi-ink-soft">
        ⚖️ <b>Syahbandar</b> — adili sengketa Tukar Guling: sahkan atau batalkan, tetapkan pihak bersalah (bea-nya hangus,
        menanggung biaya pengembalian selisih, dicatat pelanggaran). Tidak ada ganti rugi antar-user. Sengketa yang
        belum diputus {HARI_ESKALASI} hari dikabarkan ke Ketua.
      </p>
      {disputes.length === 0 ? (
        <p className="rounded-[6px] border-2 border-dashed border-kongsi-olive bg-kongsi-parchment px-4 py-8 text-center text-[13px] text-kongsi-ink-soft">
          Tidak ada sengketa. Aman terkendali.
        </p>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => {
            const lama = d.lamaHari;
            return (
              <div key={d.id} className="grid gap-3 rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-4 shadow-hard-sm md:grid-cols-[1fr_280px]">
                <div className="text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-fraunces text-base text-kongsi-indigo">
                      {d.itemA} ⇄ {d.itemB}
                    </b>
                    <span className="text-[11px] font-bold">{d.mode === "kirim" ? "📦 Kirim" : "🤝 COD"}</span>
                    {lama !== null ? (
                      <span className={lama >= HARI_ESKALASI ? "text-[11px] font-bold text-kongsi-bad" : "text-[11px] text-kongsi-ink-soft"}>
                        {lama} hari
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    A: {d.pihakA} · {formatKeping(d.valueA)} — B: {d.pihakB} · {formatKeping(d.valueB)}
                  </div>
                  {d.selisih > 0 ? (
                    <div>
                      Selisih uang {formatKeping(d.selisih)} dibayar pihak {(d.selisihDari ?? "?").toUpperCase()} ·{" "}
                      <b>{d.selisihStatus ?? "belum dibayar"}</b>
                    </div>
                  ) : d.topup > 0 ? (
                    <div>Tambah Keteng (alur lama) {formatKeping(d.topup)}</div>
                  ) : null}
                  {d.mode === "cod" ? (
                    <div>
                      Pindaian: kode A {d.scannedA ? "✓ dipindai" : "—"} · kode B {d.scannedB ? "✓ dipindai" : "—"}
                    </div>
                  ) : (
                    <div>Paket: {d.paket.map((p) => `${p.leg === "a_to_b" ? "A→B" : "B→A"} ${p.status}${p.awb ? ` (${p.awb})` : ""}`).join(" · ") || "—"}</div>
                  )}
                  <div>
                    Ditahan:{" "}
                    {d.ditahan.length ? d.ditahan.map((h) => `${h.pihak.toUpperCase()} ${h.kind} ${formatKeping(h.amount)}`).join(" · ") : "—"}
                  </div>
                  <p className="mt-2 rounded-[4px] bg-kongsi-parchment-3 p-2">{d.reason ?? "—"}</p>
                  {d.buktiUrl ? (
                    <a href={d.buktiUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-bold text-kongsi-grenadine">
                      Foto bukti ↗
                    </a>
                  ) : null}
                  {d.fault ? <div className="mt-1 font-bold text-kongsi-bad">Penyebab menurut sistem: pihak {d.fault.toUpperCase()}</div> : null}
                </div>
                <DisputeResolve id={d.id} saran={d.fault === "a" || d.fault === "b" ? d.fault : null} />
              </div>
            );
          })}
        </div>
      )}
      <h3 className="pt-4 font-fraunces text-lg font-black text-kongsi-indigo">Klaim asuransi kurir</h3>
      <p className="text-[13px] text-kongsi-ink-soft">
        Paket hilang/rusak: ajukan klaim di KiriminAja, catat di sini. Kongsi tidak menalangi — hanya meneruskan nominal yang
        benar-benar cair (dipotong biaya transfer) lewat Transfer Keluar. Klaim ditolak kurir = tidak ada ganti.
      </p>
      {klaim.calon.length === 0 && klaim.klaim.length === 0 ? (
        <p className="text-[13px] text-kongsi-ink-soft">Tidak ada paket bermasalah.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {klaim.calon.map((p) => (
            <div key={p.id} className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment p-3 text-[12px] shadow-hard-sm">
              <b>{p.leg === "a_to_b" ? p.deal.itemA.title : p.deal.itemB.title}</b> · resi {p.awb} · {p.status}
              <div className="text-kongsi-ink-soft">
                {p.status_text} · nilai {formatKeping(p.item_value)} · asuransi {formatKeping(p.insurance)}
              </div>
              <div className="mt-2">
                <CatatKlaim shipmentId={p.id} />
              </div>
            </div>
          ))}
          {klaim.klaim.map((k) => (
            <div key={k.id} className="rounded-[6px] border-2 border-kongsi-ink bg-kongsi-parchment-3 p-3 text-[12px] shadow-hard-sm">
              Klaim <b>{k.nomor_klaim}</b> ({k.jenis}) · <b>{k.status}</b>
              {k.nominal_cair ? ` · cair ${formatKeping(k.nominal_cair)}` : ""}
              {k.catatan ? <div className="text-kongsi-ink-soft">{k.catatan}</div> : null}
              {k.status === "diajukan" ? (
                <div className="mt-2">
                  <PutusKlaim id={k.id} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <h3 className="pt-4 font-fraunces text-lg font-black text-kongsi-indigo">
        Antrean Tera Penaksir ({tera.length})
      </h3>
      <p className="text-[13px] text-kongsi-ink-soft">
        Pemilik merasa taksiran Juru Taksir kurang tepat. Tetapkan nilai dengan dasar yang jelas — barang lalu berlabel
        &ldquo;ditera Penaksir&rdquo;.
      </p>
      <TeraPenaksir items={tera} />

      <h3 className="pt-4 font-fraunces text-lg font-black text-kongsi-indigo">
        Harga Komoditas — patokan Taksiran
      </h3>
      <p className="text-[13px] text-kongsi-ink-soft">
        Harga per satuan untuk menaksir barang komoditas (beras, gula, minyak). Barang baru memakai harga
        terbaru; barang yang sudah tayang tidak berubah.
      </p>
      <HargaKomoditas rows={komoditas} />
    </div>
  );
}
