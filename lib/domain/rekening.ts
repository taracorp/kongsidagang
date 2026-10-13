import "server-only";
import { prisma } from "@/lib/db";
import { BANK } from "@/lib/data/bank";
import { beriKabar } from "@/lib/domain/kabar-user";
import type { Tx } from "@/lib/domain/pundi";

// Rekening bank user untuk menerima pencairan selisih Tukar Guling / pengembalian dana.
// Transfer keluar membaca rekening TERBARU saat pengurus membayar (dan menyimpan salinannya di catatan transfer).

export type RekeningInput = { bank: string; nomor: string; atas_nama: string };

export function rapikanRekening(i: RekeningInput): RekeningInput {
  const bank = String(i?.bank ?? "").trim();
  const nomor = String(i?.nomor ?? "").replace(/[\s.-]/g, "");
  const atas_nama = String(i?.atas_nama ?? "").replace(/\s+/g, " ").trim();
  if (!BANK.some((b) => b.kode === bank)) throw new Error("Pilih bank dari daftar.");
  if (!/^\d{5,20}$/.test(nomor)) throw new Error("Nomor rekening 5–20 angka.");
  if (atas_nama.length < 3 || atas_nama.length > 60) throw new Error("Tulis nama pemilik rekening (3–60 huruf).");
  return { bank, nomor, atas_nama };
}

export async function simpanRekening(userId: string, input: RekeningInput) {
  const r = rapikanRekening(input);
  const lama = await prisma.rekeningUser.findUnique({ where: { user_id: userId } });
  await prisma.rekeningUser.upsert({ where: { user_id: userId }, create: { user_id: userId, ...r }, update: r });
  if (lama && (lama.nomor !== r.nomor || lama.bank !== r.bank)) {
    // Jejak perubahan: bila bukan pemilik akun yang mengubah, ia segera tahu.
    await beriKabar(prisma, userId, {
      kind: "pundi",
      title: "Rekening pencairan diubah",
      body: `${r.bank} ••••${r.nomor.slice(-4)} a.n. ${r.atas_nama}. Bukan kamu? Segera ganti sandi & hubungi Kongsi.`,
      href: "/pakhuis/rekening",
    });
  }
  return r;
}

export function bacaRekening(db: Tx | typeof prisma, userId: string) {
  return db.rekeningUser.findUnique({ where: { user_id: userId } });
}

/** Lempar error bila user belum mengisi rekening (wajib sebelum ikut tukar ber-selisih uang). */
export async function pastikanRekening(db: Tx | typeof prisma, userId: string, untuk: string) {
  const r = await bacaRekening(db, userId);
  if (!r) throw new Error(`Isi rekening pencairan dulu di Pakhuis (${untuk}).`);
  return r;
}
