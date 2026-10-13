// Uji Fase 5 — klaim asuransi kurir (diteruskan setelah cair, tanpa talangan) di kongsi_dev:
//   npx tsx --conditions=react-server scripts/uji/klaim.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { prisma } = await import("@/lib/db");
  const K = await import("@/lib/domain/klaim");
  const { BIAYA_TRANSFER } = await import("@/lib/domain/tukar-aturan");
  let fail = 0;
  const ok = (c: boolean, m: string) => { console.log(c ? "✓" : "✗", m); if (!c) fail++; };
  const galat = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message || "galat"; } };

  const ids = ["uji-klaim-a", "uji-klaim-b", "uji-klaim-admin"];
  const [A, B, ADM] = ids;
  await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of ids) await prisma.user.create({ data: { id, name: id, email: `${id}@uji.local` } });
  const alamat = { name: "x", phone: "0812", address: "Jl", area: "x", district_id: 1, subdistrict_id: 1, zipcode: "1", lat: 0, lng: 0 };
  const deals: string[] = [];
  async function paket(status: string, insurance: number) {
    const ia = await prisma.barterItem.create({ data: { user_id: A, title: "Kamera A", est_value: 1_000_000, status: "dalam_tukar" } });
    const ib = await prisma.barterItem.create({ data: { user_id: B, title: "Lensa B", est_value: 1_000_000, status: "dalam_tukar" } });
    const d = await prisma.barterDeal.create({ data: { item_a: ia.id, item_b: ib.id, proposer_id: A, status: "disputed", mode: "kirim", value_a: 1_000_000, value_b: 1_000_000 } });
    deals.push(d.id);
    return prisma.barterShipment.create({
      data: {
        deal_id: d.id, leg: "a_to_b", payer_id: B, origin: alamat, destination: alamat, weight_g: 500, length_cm: 10, width_cm: 10, height_cm: 10,
        item_value: 1_000_000, courier: "jne", service_type: "REG", service_name: "JNE REG", shipping_cost: 20_000, insurance, status,
        order_id: `KDG-UJI${Math.random().toString(36).slice(2, 9)}`, awb: "AWBUJI",
      },
    });
  }

  try {
    const s1 = await paket("problem", 2_000);
    ok((await galat(() => K.catatKlaim(A, { shipmentId: s1.id, nomorKlaim: "KLM-1", jenis: "hilang" }))).includes("sendiri"), "pihak tukar tidak bisa mengurus klaimnya sendiri");
    ok((await K.daftarKlaimAdmin()).calon.some((c) => c.id === s1.id), "paket bermasalah muncul sebagai calon klaim");
    const k1 = await K.catatKlaim(ADM, { shipmentId: s1.id, nomorKlaim: "KLM-1", jenis: "hilang" });
    ok(k1.penerima_id === A && k1.status === "diajukan", "klaim dicatat; penerima default = pemilik barang (pengirim)");
    ok((await galat(() => K.catatKlaim(ADM, { shipmentId: s1.id, nomorKlaim: "KLM-1b", jenis: "hilang" }))).includes("sudah"), "satu klaim per paket");
    ok((await prisma.transferKeluar.count({ where: { user_id: A } })) === 0, "belum ada uang keluar sebelum klaim cair (tanpa talangan)");
    await K.klaimCair(ADM, k1.id, 950_000);
    const tr = await prisma.transferKeluar.findFirstOrThrow({ where: { ref: k1.id } });
    ok(tr.jenis === "klaim_asuransi" && tr.user_id === A && tr.nominal === 950_000 - BIAYA_TRANSFER, `klaim cair 950rb → ditransfer ${tr.nominal} (dipotong biaya transfer)`);
    ok((await galat(() => K.klaimCair(ADM, k1.id, 950_000))).includes("sudah"), "tidak bisa dicairkan dua kali");

    const s2 = await paket("returned", 2_000);
    const k2 = await K.catatKlaim(ADM, { shipmentId: s2.id, nomorKlaim: "KLM-2", jenis: "rusak", penerima: "penerima" });
    ok(k2.penerima_id === B, "Syahbandar boleh menetapkan penerima paket sebagai penerima klaim");
    await K.klaimDitolak(ADM, k2.id, "Kemasan tidak memenuhi syarat kurir");
    ok((await prisma.klaimAsuransi.findUniqueOrThrow({ where: { id: k2.id } })).status === "ditolak" && (await prisma.transferKeluar.count({ where: { ref: k2.id } })) === 0,
      "klaim ditolak kurir → tidak ada ganti dari Kongsi");

    const s3 = await paket("problem", 0);
    ok((await galat(() => K.catatKlaim(ADM, { shipmentId: s3.id, nomorKlaim: "KLM-3", jenis: "hilang" }))).includes("tidak diasuransikan"), "paket tanpa asuransi tidak bisa diklaim");
  } finally {
    await prisma.klaimAsuransi.deleteMany({ where: { deal_id: { in: deals } } });
    await prisma.transferKeluar.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.barterItem.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
  if (fail) { console.error(`${fail} gagal`); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
