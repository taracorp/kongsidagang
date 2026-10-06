import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  deteksiKondisi,
  kunciRiset,
  olahPembanding,
  skorCocok,
  tokenKueri,
  type Pembanding,
  type Statistik,
} from "@/lib/taksir/ekstrak";
import { cariBigGo, cariPencarian, tiruan, type Mentah } from "@/lib/taksir/sumber";

// Riset harga pasar Juru Taksir: gabungkan BigGo + cuplikan mesin pencari + harga loji mitra,
// cocokkan dengan kueri, pisahkan baru/bekas, ringkas, lalu simpan (cache 7 hari, dipakai bersama).

const CACHE_HARI = 7;
const MAKS_PER_HARI = Number(process.env.TAKSIR_MAKS_PER_HARI || 20);
const MAKS_DISIMPAN = 40;

export type HasilRiset = {
  id: string;
  kueri: string;
  kategori: string;
  pembanding: Pembanding[];
  statistik: Statistik;
  sumberOk: string[];
  dariCache: boolean;
};

const jejak = new Map<string, number[]>();
function cekBatas(userId: string) {
  const now = Date.now();
  const t = (jejak.get(userId) ?? []).filter((x) => now - x < 24 * 3600_000);
  if (t.length >= MAKS_PER_HARI) throw new Error(`Batas ${MAKS_PER_HARI} riset harga per hari tercapai. Coba lagi besok.`);
  jejak.set(userId, [...t, now]);
}

function keHasil(r: {
  id: string;
  query_text: string;
  category: string;
  pembanding: Prisma.JsonValue;
  statistik: Prisma.JsonValue;
  sumber_ok: string[];
}, dariCache: boolean): HasilRiset {
  return {
    id: r.id,
    kueri: r.query_text,
    kategori: r.category,
    pembanding: (Array.isArray(r.pembanding) ? r.pembanding : []) as unknown as Pembanding[],
    statistik: (r.statistik ?? { baru: null, bekas: null }) as unknown as Statistik,
    sumberOk: r.sumber_ok,
    dariCache,
  };
}

/** Harga dari loji mitra (Neraca) yang product_key-nya cocok dengan kueri. */
async function dariLoji(kueri: string): Promise<Mentah[]> {
  const tk = tokenKueri(kueri);
  if (tk.kuat.length === 0) return [];
  const rows = await prisma.priceListing.findMany({
    where: { OR: tk.kuat.map((t) => ({ product_key: { contains: t, mode: "insensitive" as const } })) },
    select: { product_key: true, loji_name: true, price: true },
    take: 30,
  });
  return rows.map((r) => ({
    sumber: `Loji ${r.loji_name}`,
    judul: r.product_key.replace(/[-_]/g, " "),
    harga: r.price,
    url: `/neraca?q=${encodeURIComponent(r.product_key)}`,
    asal: "internal" as const,
  }));
}

/** Riset harga untuk satu kueri. Memakai cache bila masih berlaku. */
export async function risetHarga(
  userId: string,
  kueriAsli: string,
  kategori: string,
  opsi: { koleksi?: boolean } = {},
): Promise<HasilRiset> {
  const kueri = kueriAsli.trim().replace(/\s+/g, " ").slice(0, 120);
  if (kueri.length < 4) throw new Error("Tulis nama & tipe barang lebih lengkap.");
  const key = kunciRiset(kueri, kategori) + (opsi.koleksi ? ":koleksi" : "");

  const lama = await prisma.priceResearch.findUnique({ where: { query_key: key } });
  if (lama && lama.expires_at > new Date()) return keHasil(lama, true);

  cekBatas(userId);

  const tk = tokenKueri(kueri);
  if (tk.kuat.length === 0 && tk.biasa.length < 2) {
    throw new Error("Sebutkan merek & tipe/seri (mis. \"Polytron PLD 32T1850\") agar bisa dibandingkan.");
  }

  const tugas: { nama: string; jalan: () => Promise<Mentah[]> }[] =
    process.env.TAKSIR_MOCK === "true"
      ? [{ nama: "tiruan", jalan: async () => tiruan(kueri) }]
      : [
          { nama: "BigGo", jalan: () => cariBigGo(kueri) },
          { nama: "BigGo bekas", jalan: () => cariBigGo(`${kueri} bekas`) },
          { nama: "Pencarian", jalan: () => cariPencarian(`${kueri} harga`) },
          { nama: "Pencarian bekas", jalan: () => cariPencarian(`${kueri} bekas`) },
          ...(opsi.koleksi ? [{ nama: "Pencarian kolektor", jalan: () => cariPencarian(`${kueri} antik kolektor harga`) }] : []),
          { nama: "Loji mitra", jalan: () => dariLoji(kueri) },
        ];

  const hasil = await Promise.allSettled(tugas.map((t) => t.jalan()));
  const sumberOk = tugas.filter((_, i) => hasil[i].status === "fulfilled").map((t) => t.nama);
  const mentah = hasil.flatMap((h) => (h.status === "fulfilled" ? h.value : []));

  const cocok: Pembanding[] = mentah
    .filter((m) => skorCocok(tk, kueri, m.judul) > 0)
    .map((m) => ({ ...m, kondisi: deteksiKondisi(m.judul, m.url, m.sumber) }));
  const { pembanding, statistik } = olahPembanding(cocok);

  const data = {
    query_text: kueri,
    category: kategori,
    pembanding: pembanding.slice(0, MAKS_DISIMPAN) as unknown as Prisma.InputJsonArray,
    statistik: statistik as unknown as Prisma.InputJsonObject,
    sumber_ok: sumberOk,
    expires_at: new Date(Date.now() + CACHE_HARI * 24 * 3600_000),
  };
  const row = await prisma.priceResearch.upsert({
    where: { query_key: key },
    create: { query_key: key, ...data },
    update: { ...data, created_at: new Date() },
  });
  return keHasil(row, false);
}

export async function bacaRiset(id: string): Promise<HasilRiset | null> {
  const r = await prisma.priceResearch.findUnique({ where: { id } });
  return r ? keHasil(r, true) : null;
}
