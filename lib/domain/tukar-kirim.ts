import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { hold, captureHold, credit, refundHold, type Tx } from "@/lib/domain/pundi";
import { JAM_KONFIRMASI, pastikanBoleh } from "@/lib/domain/tukar-aturan";
import { kabarDeal, kunciDeal, pihakDari, sengketaSistem, terima, type DealRow, type OngkirKutipan } from "@/lib/domain/tukar";
import {
  KiriminAjaBelumBayar,
  KiriminAjaError,
  kurir,
  prefixOrder,
  termurah,
  type Alamat,
  type Paket,
  type Tarif,
  type Wilayah,
} from "@/lib/shipping/kiriminaja";

// Mode Kirim Tukar Guling (KiriminAja, express).
// 1. B menerima + memilih alamat → tarif termurah dua arah dihitung, dua paket "quoted" dibuat. B langsung menahan
//    ongkir paket A→B (barang yang B terima, "bayar apa yang kamu terima") + deposit + bea (tukar.ts tahanJaminan).
// 2. A menyetor dalam tenggat: ongkir paket B→A + deposit + bea (+ selisih uang bila ia pembayar).
// 3. Semua lunas → dua order dibuat di KiriminAja; ongkir rekber diambil (dibayar dari KA Credit).
// 4. Webhook: paket jalan/sampai/bermasalah. Dua paket sampai → "diterima" → konfirmasi / otomatis → selesai.

const JAM = 3600_000;
type Leg = "a_to_b" | "b_to_a";

type ItemKirim = {
  title: string;
  est_value: number;
  ship_weight_kg: number | null;
  categoryRef: {
    kind: string;
    ship_length_cm: number | null;
    ship_width_cm: number | null;
    ship_height_cm: number | null;
  } | null;
};

/** Berat & dimensi dikunci dari kategori (user tidak bisa mengubahnya). */
export function paketUntuk(item: ItemKirim): Paket {
  if (!item.categoryRef) throw new Error("Barang tanpa kategori taksiran hanya bisa COD.");
  const weight_g = Math.max(100, Math.round((item.ship_weight_kg ?? 1) * 1000));
  const c = item.categoryRef;
  let dims: [number, number, number];
  if (c.kind === "aset" && c.ship_length_cm && c.ship_width_cm && c.ship_height_cm) {
    dims = [c.ship_length_cm, c.ship_width_cm, c.ship_height_cm];
  } else {
    // Komoditas padat: kubus yang volumetriknya (p×l×t÷6 gram) setara berat asli.
    const side = Math.max(10, Math.ceil(Math.cbrt(weight_g * 6)));
    dims = [side, side, side];
  }
  return { weight_g, length_cm: dims[0], width_cm: dims[1], height_cm: dims[2], item_value: item.est_value };
}

type AlamatRow = {
  name: string;
  phone: string;
  address: string;
  area: string;
  district_id: number;
  subdistrict_id: number;
  zipcode: string;
  lat: number;
  lng: number;
};

export function snapshotAlamat(a: AlamatRow): Alamat {
  return {
    name: a.name,
    phone: a.phone,
    address: a.address,
    area: a.area,
    district_id: a.district_id,
    subdistrict_id: a.subdistrict_id,
    zipcode: a.zipcode,
    lat: a.lat,
    lng: a.lng,
  };
}

const wilayah = (a: Alamat): Wilayah => ({
  district_id: a.district_id,
  subdistrict_id: a.subdistrict_id,
  full_address: a.area,
  zipcode: a.zipcode,
});

const ITEM_SELECT = {
  user_id: true,
  title: true,
  est_value: true,
  ship_weight_kg: true,
  categoryRef: { select: { kind: true, ship_length_cm: true, ship_width_cm: true, ship_height_cm: true } },
} as const;

type Kutipan = { leg: Leg; payer_id: string; origin: Alamat; destination: Alamat; paket: Paket; tarif: Tarif };

/** Hitung tarif termurah dua arah (dipanggil di luar transaksi karena memanggil API). */
async function kutipDuaArah(userIdB: string, dealId: string, addressIdB: string): Promise<Kutipan[]> {
  const drv = kurir();
  if (!drv) throw new Error("Mode Kirim belum tersedia.");
  const d = await prisma.barterDeal.findUnique({
    where: { id: dealId },
    select: {
      mode: true,
      address_a_id: true,
      itemA: { select: ITEM_SELECT },
      itemB: { select: ITEM_SELECT },
    },
  });
  if (!d || d.mode !== "kirim") throw new Error("Tawaran ini bukan mode Kirim.");
  if (d.itemB.user_id !== userIdB) throw new Error("Bukan pihak penerima tawaran ini.");
  const [addrA, addrB] = await Promise.all([
    d.address_a_id ? prisma.userAddress.findUnique({ where: { id: d.address_a_id } }) : null,
    prisma.userAddress.findFirst({ where: { id: addressIdB, user_id: userIdB } }),
  ]);
  if (!addrA) throw new Error("Alamat pengaju tidak ditemukan.");
  if (!addrB) throw new Error("Pilih alamat pengiriman.");
  const A = snapshotAlamat(addrA);
  const B = snapshotAlamat(addrB);
  const pA = paketUntuk(d.itemA);
  const pB = paketUntuk(d.itemB);
  const [tAB, tBA] = await Promise.all([drv.tarif(wilayah(A), wilayah(B), pA), drv.tarif(wilayah(B), wilayah(A), pB)]);
  const ab = termurah(tAB);
  const ba = termurah(tBA);
  if (!ab || !ba) throw new Error("Belum ada kurir yang melayani rute ini. Coba COD.");
  return [
    { leg: "a_to_b", payer_id: d.itemB.user_id, origin: A, destination: B, paket: pA, tarif: ab },
    { leg: "b_to_a", payer_id: d.itemA.user_id, origin: B, destination: A, paket: pB, tarif: ba },
  ];
}

/** Log status paket (maks 50 terakhir). */
function tambahEvent(lama: Prisma.JsonValue, ev: Record<string, string | null>): Prisma.InputJsonArray {
  const arr = Array.isArray(lama) ? (lama as Prisma.InputJsonValue[]) : [];
  return [...arr, ev].slice(-50);
}

const ongkirDari = (t: { shipping_cost: number; insurance: number }) => t.shipping_cost + t.insurance;

/** Ongkir kedua paket (kutipan kurir terkini) — untuk menghitung jaminan sebelum B menerima. */
export async function kutipanTerima(userId: string, dealId: string, addressId: string): Promise<OngkirKutipan> {
  return keOngkir(await kutipDuaArah(userId, dealId, addressId));
}

function keOngkir(kutipan: Kutipan[]): OngkirKutipan {
  const biaya = (leg: Leg) => kutipan.filter((k) => k.leg === leg).reduce((t, k) => t + k.tarif.cost + k.tarif.insurance, 0);
  return { a_to_b: biaya("a_to_b"), b_to_a: biaya("b_to_a") };
}

/** Ongkir yang belum dilunasi user pada deal ini (untuk Bayar Langsung). */
export async function hitungBayarOngkir(userId: string, dealId: string): Promise<number> {
  const d = await prisma.barterDeal.findUnique({ where: { id: dealId }, include: { shipments: true, itemA: { select: { user_id: true } }, itemB: { select: { user_id: true } } } });
  if (!d) throw new Error("Tawaran tidak ditemukan.");
  pastikanBoleh(d.status, pihakDari(d, userId), "bayar_ongkir", d.mode);
  const s = d.shipments.find((x) => x.payer_id === userId);
  if (!s) throw new Error("Paket tidak ditemukan.");
  if (s.status !== "quoted") throw new Error("Ongkir sudah dilunasi.");
  return ongkirDari(s);
}

/** B menerima tawaran mode Kirim: dua paket "quoted" dibuat; jaminan ditahan di tukar.ts (terima → tahanJaminan). */
export async function terimaKirim(userId: string, dealId: string, addressId: string) {
  const kutipan = await kutipDuaArah(userId, dealId, addressId);
  return terima(userId, dealId, { addressId }, {
    ongkir: keOngkir(kutipan),
    buatPaket: async (tx, d, addressB) => {
      if (addressB !== addressId) throw new Error("Alamat berubah, ulangi.");
      for (const k of kutipan) {
        await tx.barterShipment.create({
          data: {
            deal_id: d.id,
            leg: k.leg,
            payer_id: k.payer_id,
            origin: k.origin as unknown as Prisma.InputJsonObject,
            destination: k.destination as unknown as Prisma.InputJsonObject,
            weight_g: k.paket.weight_g,
            length_cm: k.paket.length_cm,
            width_cm: k.paket.width_cm,
            height_cm: k.paket.height_cm,
            item_value: k.paket.item_value,
            courier: k.tarif.courier,
            service_type: k.tarif.service_type,
            service_name: k.tarif.service_name,
            etd: k.tarif.etd,
            shipping_cost: k.tarif.cost,
            insurance: k.tarif.insurance,
            status: "quoted",
          },
        });
      }
    },
  });
}

/** Alur lama (v2): tahan ongkir satu paket. */
async function bayarLeg(tx: Tx, d: DealRow, s: { id: string; payer_id: string; shipping_cost: number; insurance: number }) {
  const amt = ongkirDari(s);
  if (amt > 0) await hold(tx, s.payer_id, d.id, amt, "ongkir", `Tahan ongkir Tukar: ${d.itemA.title} ⇄ ${d.itemB.title}`);
  await tx.barterShipment.update({ where: { id: s.id }, data: { status: "paid" } });
}

/** Pihak melunasi ongkir paket yang akan ia terima. Bila dua-duanya lunas → paket dibuat di kurir. */
export async function bayarOngkir(userId: string, dealId: string) {
  const semuaLunas = await prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    pastikanBoleh(d.status, pihakDari(d, userId), "bayar_ongkir", d.mode);
    const s = d.shipments.find((x) => x.payer_id === userId);
    if (!s) throw new Error("Paket tidak ditemukan.");
    if (s.status !== "quoted") throw new Error("Ongkir sudah dilunasi.");
    await bayarLeg(tx, d, s);
    return d.shipments.every((x) => x.id === s.id || x.status !== "quoted");
  });
  if (semuaLunas) await kirimkanPaket(dealId);
}

function orderIdBaru(dealId: string, leg: Leg) {
  // ≤ 20 karakter (batas tracking KiriminAja), berawalan prefix akun (KDG-), unik per percobaan.
  const sisa = 20 - prefixOrder().length - 5;
  return `${prefixOrder()}${dealId.replace(/-/g, "").slice(0, Math.max(4, sisa)).toUpperCase()}${leg === "a_to_b" ? "A" : "B"}${randomBytes(2).toString("hex").toUpperCase()}`.slice(0, 20);
}

/** Tagih ongkir pembayar (hold → pendapatan, menutup KA Credit yang dipakai) bila masih ditahan. Idempoten. */
async function tagihOngkir(tx: Tx, dealId: string, s: { payer_id: string; service_name: string; leg: string }, judul: string) {
  const h = await tx.walletHold.findFirst({ where: { deal_id: dealId, user_id: s.payer_id, kind: "ongkir", status: "ditahan" } });
  if (h) await captureHold(tx, h.id, "ongkir_tukar", `Ongkir ${s.service_name}: ${judul}`);
}

/**
 * Buat order di KiriminAja untuk paket yang sudah lunas (atau gagal sebelumnya).
 * Pengaman uang platform (KA Credit):
 * - paket diklaim di bawah kunci deal & hanya bila deal masih "agreed" (tidak berlomba dengan pembatalan);
 * - KiriminAja menolak (KiriminAjaError) → pasti tidak terbentuk → "failed", boleh diulang;
 * - galat lain (timeout/jaringan) atau terbentuk-tapi-belum-bayar → "perlu_cek": order_id DIPERTAHANKAN dan
 *   dipastikan lewat pelacakan (rekonsiliasiPaket), TIDAK dibuat ulang → tidak ada ongkir dobel;
 * - sukses → data order disimpan segera, ongkir pembayar ditagih (diulang cron bila gagal).
 */
export async function kirimkanPaket(dealId: string): Promise<{ dibuat: number; gagal: string[] }> {
  const drv = kurir();
  if (!drv) throw new Error("Mode Kirim belum tersedia.");
  const d = await prisma.barterDeal.findUnique({
    where: { id: dealId },
    include: { shipments: true, itemA: { select: { title: true } }, itemB: { select: { title: true } } },
  });
  if (!d || d.mode !== "kirim" || d.status !== "agreed") return { dibuat: 0, gagal: [] };
  if (d.shipments.some((s) => s.status === "quoted")) return { dibuat: 0, gagal: [] }; // belum lunas semua

  let jadwal: string | null = null;
  let dibuat = 0;
  const gagal: string[] = [];
  for (const s of d.shipments) {
    if (s.status !== "paid" && s.status !== "failed") continue;
    const order_id = orderIdBaru(d.id, s.leg as Leg);
    const judul = s.leg === "a_to_b" ? d.itemA.title : d.itemB.title;
    const diklaim = await prisma.$transaction(async (tx) => {
      const x = await kunciDeal(tx, dealId);
      if (x.status !== "agreed") return false;
      const r = await tx.barterShipment.updateMany({
        where: { id: s.id, status: { in: ["paid", "failed"] } },
        data: { status: "requested", order_id, status_text: "Membuat order di kurir…" },
      });
      return r.count === 1;
    });
    if (!diklaim) continue;
    let hasil: Awaited<ReturnType<typeof drv.buatOrder>>;
    try {
      jadwal ??= await drv.jadwalPickup();
      hasil = await drv.buatOrder({
        order_id,
        sender: s.origin as Alamat,
        receiver: s.destination as Alamat,
        paket: { weight_g: s.weight_g, length_cm: s.length_cm, width_cm: s.width_cm, height_cm: s.height_cm, item_value: s.item_value },
        tarif: {
          courier: s.courier,
          service_type: s.service_type,
          service_name: s.service_name,
          cost: s.shipping_cost,
          insurance: s.insurance,
          etd: s.etd,
          group: "",
        },
        item_name: judul,
        schedule: jadwal,
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : "Gagal membuat order";
      gagal.push(m);
      const pastiTidakAda = e instanceof KiriminAjaError && !(e instanceof KiriminAjaBelumBayar);
      await prisma.barterShipment.update({
        where: { id: s.id },
        data: pastiTidakAda
          ? { status: "failed", order_id: null, status_text: m.slice(0, 300) }
          : { status: "perlu_cek", status_text: `Menunggu kepastian dari kurir: ${m}`.slice(0, 300) },
      });
      continue;
    }
    // Order PASTI terbentuk: simpan dulu (satu perintah), baru tagih ongkir.
    await prisma.barterShipment.update({
      where: { id: s.id },
      data: {
        pickup_number: hasil.pickup_number,
        awb: hasil.awb,
        status_text: `Menunggu pickup kurir (${jadwal})`,
        events: tambahEvent(s.events, { at: new Date().toISOString(), method: "request_pickup", pickup: hasil.pickup_number }),
      },
    });
    await prisma.$transaction((tx) => tagihOngkir(tx, d.id, s, judul)).catch((e) => console.error("[tukar] tagih ongkir ditunda:", e));
    dibuat++;
  }

  await majukanKeDikirim(dealId);
  return { dibuat, gagal };
}

/** Dua paket sudah terbentuk di kurir → deal berjalan (penahanan silang dipantau cron). */
async function majukanKeDikirim(dealId: string) {
  await prisma.$transaction(async (tx) => {
    const x = await kunciDeal(tx, dealId);
    const terbentuk = (s: { order_id: string | null; status: string }) => !!s.order_id && !["failed", "perlu_cek", "perlu_batal", "canceled"].includes(s.status);
    if (x.status === "agreed" && x.shipments.length === 2 && x.shipments.every(terbentuk)) {
      await tx.barterDeal.update({ where: { id: x.id }, data: { status: "dikirim", expires_at: null } });
      await kabarDeal(tx, x, "keduanya", "Paket dibuat — siapkan barangmu", "Kurir menjemput sesuai jadwal. Kemas barang dengan aman.");
    }
  });
}

/** Kembalikan ongkir (Keteng) setelah KiriminAja PASTI membatalkan (KA Credit kembali). Atomik & idempoten. */
async function selesaikanBatalPaket(tx: Tx, shipmentId: string, sebab: string) {
  const s = await tx.barterShipment.findUnique({ where: { id: shipmentId } });
  if (!s) return false;
  const r = await tx.barterShipment.updateMany({
    where: { id: s.id, status: "perlu_batal" },
    data: { status: "canceled", status_text: `Dibatalkan di kurir: ${sebab}`.slice(0, 300) },
  });
  if (r.count !== 1) return false;
  const amt = ongkirDari(s);
  // Ongkir masih ditahan (belum ditagih) → kembalikan tahanannya; sudah ditagih → kredit balik (KA Credit sudah kembali).
  const h = await tx.walletHold.findFirst({ where: { deal_id: s.deal_id, user_id: s.payer_id, kind: "ongkir", status: "ditahan" } });
  if (h) await refundHold(tx, h.id, "Ongkir Tukar Guling dikembalikan (order kurir dibatalkan)");
  else if (amt > 0) await credit(tx, s.payer_id, amt, "refund_ongkir", "Ongkir Tukar Guling dikembalikan (order kurir dibatalkan)");
  return true;
}

/**
 * Rekonsiliasi paket (cron): memastikan uang platform tidak bocor ke kurir.
 * 1. "perlu_cek": lacak order → ada → lanjut seperti sukses (tagih ongkir); tidak ditemukan → "failed".
 * 2. Order terbentuk tetapi ongkir masih ditahan → tagih.
 * 3. "perlu_batal": batalkan di KiriminAja → sukses → ongkir kembali; ditolak karena sudah jalan → ongkir hangus.
 */
export async function rekonsiliasiPaket(): Promise<{ dicek: number; dibatalkan: number; hangus: number }> {
  const drv = kurir();
  const hasil = { dicek: 0, dibatalkan: 0, hangus: 0 };
  if (!drv) return hasil;
  const daftar = await prisma.barterShipment.findMany({
    where: { status: { in: ["perlu_cek", "perlu_batal", "requested", "shipped", "delivered"] }, order_id: { not: null } },
    include: { deal: { include: { itemA: { select: { title: true } }, itemB: { select: { title: true } } } } },
    take: 100,
  });
  const batasRagu = new Date(Date.now() - 5 * 60_000);
  for (const s of daftar) {
    const judul = s.leg === "a_to_b" ? s.deal.itemA.title : s.deal.itemB.title;
    // "Ragu" = jawaban buatOrder tidak pernah tersimpan (galat jaringan / proses terputus di tengah).
    // Diberi jeda 5 menit agar tidak mendahului buatOrder yang masih berjalan.
    const ragu = s.status === "perlu_cek" || (s.status === "requested" && !s.pickup_number && !s.awb);
    if (ragu && s.updated_at > batasRagu) continue;
    if (ragu) {
      const l = await drv.lacak(s.order_id!).catch((e: Error) => e);
      if (l instanceof Error) {
        if (/tidak ditemukan|not found|tidak ada/i.test(l.message)) {
          await prisma.barterShipment.update({ where: { id: s.id }, data: { status: "failed", order_id: null, status_text: "Order tidak terbentuk di kurir — boleh dicoba lagi" } });
        }
        continue; // galat sementara → coba lagi nanti
      }
      await prisma.barterShipment.update({
        where: { id: s.id },
        data: { status: "requested", awb: l.awb ?? s.awb, sorting_code: l.sorting_code ?? s.sorting_code, status_text: l.text.slice(0, 300) },
      });
      await prisma.$transaction((tx) => tagihOngkir(tx, s.deal_id, s, judul));
      await majukanKeDikirim(s.deal_id);
      hasil.dicek++;
      continue;
    }
    if (s.status === "perlu_batal") {
      let awb = s.awb;
      if (!awb) {
        const l = await drv.lacak(s.order_id!).catch((e: Error) => e);
        if (l instanceof Error) {
          // Order ternyata tidak pernah terbentuk → tidak ada biaya kurir → ongkir kembali utuh.
          if (/tidak ditemukan|not found|tidak ada/i.test(l.message)) {
            await prisma.$transaction((tx) => selesaikanBatalPaket(tx, s.id, "order tidak terbentuk"));
            hasil.dibatalkan++;
          }
          continue;
        }
        awb = l.awb;
      }
      if (!awb) continue; // belum ada AWB → tunggu
      const r = await drv.batalkan(awb, "Tukar Guling dibatalkan").catch((e: Error) => e);
      if (r instanceof Error) {
        if (r instanceof KiriminAjaError) {
          // Ditolak (mis. sudah dijemput) → ongkir hangus: menutup KA Credit yang sudah terpakai.
          await prisma.barterShipment.update({ where: { id: s.id }, data: { status: "batal_gagal", status_text: `Tidak bisa dibatalkan di kurir: ${r.message}`.slice(0, 300) } });
          await prisma.$transaction((tx) => tagihOngkir(tx, s.deal_id, s, judul));
          hasil.hangus++;
        }
        continue;
      }
      const sukses = (r.data as { success?: string } | null)?.success === "success";
      if (sukses) {
        await prisma.$transaction((tx) => selesaikanBatalPaket(tx, s.id, r.text || "berhasil"));
        hasil.dibatalkan++;
      } else {
        await prisma.barterShipment.update({ where: { id: s.id }, data: { awb, status_text: `Pembatalan diproses kurir: ${r.text}`.slice(0, 300) } });
      }
      continue;
    }
    // Terbentuk & berjalan: pastikan ongkir sudah ditagih.
    await prisma.$transaction((tx) => tagihOngkir(tx, s.deal_id, s, judul));
  }
  return hasil;
}

// ============================================================
// Webhook KiriminAja
// ============================================================

export type WebhookData = {
  order_id?: string;
  awb?: string | null;
  sorting_code?: string | null;
  shipped_at?: string | null;
  finished_at?: string | null;
  returned_at?: string | null;
  reason?: string | null;
};

const PETA_STATUS: Record<string, { status: string; teks: string }> = {
  processed_packages: { status: "requested", teks: "Resi terbit, menunggu pickup" },
  shipped_packages: { status: "shipped", teks: "Paket dibawa kurir" },
  finished_packages: { status: "delivered", teks: "Paket sampai" },
  canceled_packages: { status: "canceled", teks: "Pengiriman dibatalkan kurir/sistem" },
  returned_packages: { status: "returned", teks: "Paket diretur ke pengirim" },
  return_finished_packages: { status: "returned", teks: "Paket diretur ke pengirim" },
  problem_packages: { status: "problem", teks: "Paket bermasalah" },
};

/** Proses satu callback. Idempoten: status yang sama diulang tidak mengubah apa pun selain log. */
export async function prosesWebhook(method: string, data: WebhookData[]): Promise<number> {
  const peta = PETA_STATUS[method];
  if (!peta) return 0;
  let n = 0;
  for (const row of data) {
    if (!row.order_id) continue;
    const s = await prisma.barterShipment.findUnique({ where: { order_id: row.order_id } });
    if (s && s.status === "perlu_batal" && method === "canceled_packages") {
      // Pembatalan yang kita minta sudah diproses kurir → KA Credit kembali → ongkir user dikembalikan.
      if (await prisma.$transaction((tx) => selesaikanBatalPaket(tx, s.id, row.reason ?? "dikonfirmasi kurir"))) n++;
      continue;
    }
    if (s && ["perlu_batal", "batal_gagal", "canceled"].includes(s.status)) continue; // deal sudah ditutup
    if (!s) {
      // Paket uji dari halaman admin "Uji Kurir".
      const u = await prisma.kurirUji.updateMany({
        where: { order_id: row.order_id },
        data: {
          status: peta.status,
          status_text: (row.reason ? `${peta.teks}: ${row.reason}` : peta.teks).slice(0, 300),
          ...(row.awb ? { awb: row.awb } : {}),
          ...(row.sorting_code ? { sorting_code: row.sorting_code } : {}),
        },
      });
      n += u.count;
      continue;
    }
    const now = new Date();
    const teks = row.reason ? `${peta.teks}: ${row.reason}` : peta.teks;
    // Status akhir (sampai) tidak boleh mundur karena callback terlambat.
    const status = s.status === "delivered" && peta.status !== "returned" ? s.status : peta.status;
    await prisma.barterShipment.update({
      where: { id: s.id },
      data: {
        status,
        status_text: teks.slice(0, 300),
        awb: row.awb ?? s.awb,
        sorting_code: row.sorting_code ?? s.sorting_code,
        shipped_at: s.shipped_at ?? (row.shipped_at || status === "shipped" ? new Date(row.shipped_at ?? now) : null),
        delivered_at: status === "delivered" ? (s.delivered_at ?? new Date(row.finished_at ?? now)) : s.delivered_at,
        events: tambahEvent(s.events, { at: now.toISOString(), method, reason: row.reason ?? null }),
      },
    });
    await evaluasiDeal(s.deal_id);
    n++;
  }
  return n;
}

async function evaluasiDeal(dealId: string) {
  await prisma.$transaction(async (tx) => {
    const d = await kunciDeal(tx, dealId);
    if (!["agreed", "dikirim", "diterima"].includes(d.status) || d.mode !== "kirim") return;
    const masalah = d.shipments.find((s) => ["canceled", "returned", "problem"].includes(s.status) && s.order_id);
    if (masalah) {
      const fault = null; // kurir/sistem — Syahbandar yang menilai
      await sengketaSistem(tx, d, `Paket ${masalah.leg === "a_to_b" ? "A→B" : "B→A"}: ${masalah.status_text ?? masalah.status}`, fault);
      return;
    }
    if (d.status !== "diterima" && d.shipments.length === 2 && d.shipments.every((s) => s.status === "delivered")) {
      await tx.barterDeal.update({
        where: { id: d.id },
        data: { status: "diterima", expires_at: new Date(Date.now() + JAM_KONFIRMASI * JAM) },
      });
      await kabarDeal(tx, d, "keduanya", "Kedua paket sampai — periksa & konfirmasi", `Konfirmasi otomatis dalam ${JAM_KONFIRMASI} jam.`);
    }
  });
}

/** Lacak satu paket (pihak deal saja); simpan AWB & sorting code terbaru. */
export async function lacakPaket(userId: string, shipmentId: string) {
  const s = await prisma.barterShipment.findUnique({
    where: { id: shipmentId },
    include: { deal: { include: { itemA: { select: { user_id: true } }, itemB: { select: { user_id: true } } } } },
  });
  if (!s || !s.order_id) throw new Error("Paket belum dibuat di kurir.");
  if (s.deal.itemA.user_id !== userId && s.deal.itemB.user_id !== userId) throw new Error("Bukan pihak tukar ini.");
  const drv = kurir();
  if (!drv) throw new Error("Mode Kirim belum tersedia.");
  const l = await drv.lacak(s.awb ?? s.order_id);
  if ((l.awb && l.awb !== s.awb) || (l.sorting_code && l.sorting_code !== s.sorting_code)) {
    await prisma.barterShipment.update({
      where: { id: s.id },
      data: { awb: l.awb ?? s.awb, sorting_code: l.sorting_code ?? s.sorting_code },
    });
  }
  return l;
}
