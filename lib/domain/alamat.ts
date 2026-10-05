import "server-only";
import { prisma } from "@/lib/db";
import { kurir, normalisasiHp, kodeposDari, type Wilayah } from "@/lib/shipping/kiriminaja";

// Alamat kirim user untuk mode Kirim Tukar Guling. Hanya pemilik yang bisa membaca/mengubah.

const MAKS_ALAMAT = 5;

export type AlamatInput = {
  label: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  district_id: number;
  subdistrict_id: number;
  lat: number;
  lng: number;
};

export async function simpanAlamat(userId: string, a: AlamatInput) {
  const label = a.label.trim().slice(0, 30) || "Rumah";
  const name = a.name.trim();
  const address = a.address.trim();
  if (name.length < 2 || name.length > 60) throw new Error("Isi nama penerima (2–60 huruf).");
  if (address.length < 5 || address.length > 200) throw new Error("Isi alamat jalan, nomor, RT/RW (5–200 huruf).");
  const phone = normalisasiHp(a.phone);
  if (!Number.isInteger(a.district_id) || a.district_id <= 0 || !Number.isInteger(a.subdistrict_id) || a.subdistrict_id <= 0) {
    throw new Error("Pilih kelurahan dari hasil pencarian.");
  }
  // Koordinat wajib untuk pickup kurir; batasi ke wilayah Indonesia.
  if (!(a.lat >= -11.5 && a.lat <= 6.5 && a.lng >= 94.5 && a.lng <= 141.5)) {
    throw new Error("Tandai lokasi (tombol \"Pakai lokasiku\") — kurir butuh titik penjemputan.");
  }
  const zipcode = kodeposDari(a.area);
  if (!zipcode) throw new Error("Kelurahan tanpa kode pos — pilih hasil pencarian lain.");
  const jumlah = await prisma.userAddress.count({ where: { user_id: userId } });
  if (jumlah >= MAKS_ALAMAT) throw new Error(`Maksimal ${MAKS_ALAMAT} alamat. Hapus salah satu dulu.`);
  const row = await prisma.userAddress.create({
    data: {
      user_id: userId,
      label,
      name,
      phone,
      address,
      area: a.area.trim().slice(0, 200),
      district_id: a.district_id,
      subdistrict_id: a.subdistrict_id,
      zipcode,
      lat: a.lat,
      lng: a.lng,
    },
  });
  return row.id;
}

export async function hapusAlamat(userId: string, id: string) {
  const res = await prisma.userAddress.deleteMany({ where: { id, user_id: userId } });
  if (res.count === 0) throw new Error("Alamat tidak ditemukan.");
}

export type AlamatSaya = { id: string; label: string; name: string; phone: string; address: string; area: string };

export async function alamatSaya(userId: string): Promise<AlamatSaya[]> {
  return prisma.userAddress.findMany({
    where: { user_id: userId },
    select: { id: true, label: true, name: true, phone: true, address: true, area: true },
    orderBy: { created_at: "asc" },
  });
}

// Pencarian wilayah dibatasi (API KiriminAja menangguhkan akses bila terlalu sering dipanggil).
const cache = new Map<string, { at: number; data: Wilayah[] }>();
const jejak = new Map<string, number[]>();
const CACHE_MS = 24 * 3600_000;
const MAKS_PER_MENIT = 20;

export async function cariWilayah(userId: string, q: string): Promise<Wilayah[]> {
  const kata = q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  if (kata.length < 3) return [];
  const hit = cache.get(kata);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const now = Date.now();
  const t = (jejak.get(userId) ?? []).filter((x) => now - x < 60_000);
  if (t.length >= MAKS_PER_MENIT) throw new Error("Terlalu sering mencari. Tunggu sebentar.");
  jejak.set(userId, [...t, now]);
  const drv = kurir();
  if (!drv) throw new Error("Mode Kirim belum tersedia.");
  const data = await drv.cariWilayah(kata);
  if (cache.size > 2000) cache.clear();
  cache.set(kata, { at: now, data });
  return data;
}
