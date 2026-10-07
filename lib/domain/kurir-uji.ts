import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { kurir, kurirSandbox, normalisasiHp, type Alamat, type Wilayah } from "@/lib/shipping/kiriminaja";

// Uji Kurir (admin): uji koneksi, cakupan, ongkir, buat paket, lacak, batal, dan log webhook KiriminAja.
// Dipakai untuk UAT sandbox MitraAPI dan diagnosa di produksi. Semua lewat driver yang sama dengan Tukar Guling.

function driver() {
  const d = kurir();
  if (!d) throw new Error("KiriminAja belum dikonfigurasi (KIRIMINAJA_API_KEY).");
  return d;
}

export function infoKoneksi() {
  const d = kurir();
  return {
    terpasang: Boolean(d),
    driver: d?.nama ?? null,
    sandbox: kurirSandbox(),
    base: process.env.KIRIMINAJA_API_KEY ? process.env.KIRIMINAJA_BASE_URL || "https://client.kiriminaja.com" : null,
  };
}

/** Uji API key: panggilan terautentikasi (jadwal pickup). */
export async function cekKoneksi() {
  const t0 = Date.now();
  const jadwal = await driver().jadwalPickup();
  return { ok: true, jadwal, ms: Date.now() - t0, ...infoKoneksi() };
}

export const cariWilayah = (q: string) => driver().cariWilayah(q);

export type InputPaket = { weight_g: number; length_cm: number; width_cm: number; height_cm: number; item_value: number };

function cekPaket(p: InputPaket) {
  const n = [p.weight_g, p.length_cm, p.width_cm, p.height_cm, p.item_value].map(Number);
  if (n.some((x) => !Number.isInteger(x) || x <= 0)) throw new Error("Berat, dimensi, dan nilai barang wajib angka > 0.");
  return { weight_g: n[0], length_cm: n[1], width_cm: n[2], height_cm: n[3], item_value: n[4] };
}

/** Berat volume (gram) dengan pembagi 6000 cm³/kg. */
export const beratVolume = (p: Pick<InputPaket, "length_cm" | "width_cm" | "height_cm">) =>
  Math.ceil((p.length_cm * p.width_cm * p.height_cm) / 6);

export async function cekOngkir(asal: Wilayah, tujuan: Wilayah, p: InputPaket) {
  const paket = cekPaket(p);
  const tarif = await driver().tarif(asal, tujuan, paket);
  return tarif.sort((a, b) => a.cost - b.cost);
}

export type PihakUji = { name: string; phone: string; address: string; lat: number; lng: number; wilayah: Wilayah };
export type InputUji = {
  pengirim: PihakUji;
  penerima: PihakUji;
  paket: InputPaket;
  item_name: string;
  qty: number;
  courier: string;
  service_type: string;
  asuransi: boolean;
  skenario: string;
};

const kotaDari = (full: string) => full.split(",").map((x) => x.trim())[2] ?? "";

function alamatDari(p: PihakUji): Alamat {
  const phone = normalisasiHp(p.phone);
  if (!p.name.trim() || p.address.trim().length < 10) throw new Error("Nama & alamat lengkap pengirim/penerima wajib diisi.");
  return {
    name: p.name.trim().slice(0, 60),
    phone,
    address: p.address.trim().slice(0, 200),
    area: p.wilayah.full_address,
    district_id: p.wilayah.district_id,
    subdistrict_id: p.wilayah.subdistrict_id,
    zipcode: p.wilayah.zipcode,
    lat: Number(p.lat) || 0,
    lng: Number(p.lng) || 0,
  };
}

/** Buat paket uji Non-COD (ongkir & asuransi diambil ulang dari tarif terkini, bukan dari browser). */
export async function buatPaketUji(adminId: string, i: InputUji) {
  const d = driver();
  const paket = cekPaket(i.paket);
  const qty = Number(i.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 50) throw new Error("Jumlah item 1–50.");
  if (i.item_name.trim().length < 3) throw new Error("Nama barang minimal 3 huruf.");
  const sender = alamatDari(i.pengirim);
  const receiver = alamatDari(i.penerima);
  const tarif = (await d.tarif(i.pengirim.wilayah, i.penerima.wilayah, paket)).find(
    (t) => t.courier === i.courier && t.service_type === i.service_type,
  );
  if (!tarif) throw new Error("Layanan kurir tidak tersedia untuk rute ini. Cek ongkir ulang.");
  if (!i.asuransi && tarif.force_insurance) throw new Error(`${tarif.service_name} mewajibkan asuransi.`);
  const insurance = i.asuransi ? tarif.insurance : 0;
  const order_id = `KDU${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`.slice(0, 20);
  const schedule = await d.jadwalPickup();
  const hasil = await d.buatOrder({
    order_id,
    sender,
    receiver,
    paket,
    tarif: { ...tarif, insurance },
    item_name: i.item_name.trim(),
    qty,
    schedule,
    note: `UAT Kongsi Dagang — ${i.skenario}`.slice(0, 100),
  });
  const pihak = (a: Alamat) => ({
    name: a.name,
    phone: a.phone,
    address: a.address,
    area: a.area,
    zipcode: a.zipcode,
    city: kotaDari(a.area),
  });
  return prisma.kurirUji.create({
    data: {
      order_id,
      awb: hasil.awb,
      pickup_number: hasil.pickup_number,
      courier: tarif.courier,
      service_type: tarif.service_type,
      service_name: tarif.service_name,
      skenario: i.skenario.slice(0, 120),
      pengirim: pihak(sender),
      penerima: pihak(receiver),
      ...paket,
      item_name: i.item_name.trim().slice(0, 100),
      qty,
      shipping_cost: tarif.cost,
      insurance,
      status: "requested",
      status_text: hasil.awb ? "AWB terbit" : "Order dibuat, menunggu AWB",
      respon: (hasil.raw ?? null) as Prisma.InputJsonValue,
      dibuat_oleh: adminId,
    },
  });
}

/** Lacak paket uji; perbarui AWB & sorting code dari respons tracking. */
export async function lacakPaketUji(id: string) {
  const u = await prisma.kurirUji.findUniqueOrThrow({ where: { id } });
  const l = await driver().lacak(u.awb ?? u.order_id);
  await prisma.kurirUji.update({
    where: { id },
    data: {
      ...(l.awb ? { awb: l.awb } : {}),
      ...(l.sorting_code ? { sorting_code: l.sorting_code } : {}),
      ...(l.text ? { status_text: l.text.slice(0, 300) } : {}),
      ...(l.delivered ? { status: "delivered" } : {}),
    },
  });
  return l;
}

/** Batalkan paket uji (hanya sebelum dijemput; butuh AWB). */
export async function batalPaketUji(id: string, alasan: string) {
  const u = await prisma.kurirUji.findUniqueOrThrow({ where: { id } });
  if (!u.awb) throw new Error("AWB belum terbit — lacak dulu sampai AWB tersedia.");
  const r = await driver().batalkan(u.awb, alasan || "Uji pembatalan UAT Kongsi Dagang");
  await prisma.kurirUji.update({ where: { id }, data: { status: "canceled", status_text: (r.text || "Dibatalkan").slice(0, 300) } });
  return r;
}

export const daftarPaketUji = () => prisma.kurirUji.findMany({ orderBy: { created_at: "desc" }, take: 30 });
export const logWebhook = () => prisma.kurirWebhookLog.findMany({ orderBy: { created_at: "desc" }, take: 20 });
