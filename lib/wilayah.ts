// Pencarian & validasi kabupaten/kota (data Kepmendagri 2025). Fungsi murni: dipakai browser & server.
import { KOTA_INDONESIA } from "@/lib/data/kota-indonesia";

export type Kota = { kode: string; nama: string; provinsi: string };

const SEMUA: Kota[] = KOTA_INDONESIA.map(([kode, nama, provinsi]) => ({ kode, nama, provinsi }));

/** Huruf kecil, tanpa aksen/tanda baca, tanpa kata "kab/kabupaten/kota/adm". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(kab|kabupaten|kota|adm|administrasi)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INDEKS = SEMUA.map((k) => ({ k, nama: norm(k.nama), semua: `${norm(k.nama)} ${norm(k.provinsi)}` }));

/**
 * Cari kab/kota: tiap kata yang diketik harus menjadi awalan salah satu kata nama/provinsi.
 * Urutan: nama yang diawali ketikan lebih dulu, lalu Kota sebelum Kab. bila sama.
 * Mengetik "kota …" atau "kab …" menyaring jenisnya.
 */
export function cariKota(q: string, maks = 8): Kota[] {
  const mentah = q.toLowerCase();
  const jenis = /\bkota\b/.test(mentah) ? "Kota" : /\bkab(upaten)?\b/.test(mentah) ? "Kab." : null;
  const kata = norm(q).split(" ").filter(Boolean);
  if (!kata.length) return [];
  const cocok = INDEKS.filter(({ k, semua }) => {
    if (jenis && !k.nama.startsWith(jenis)) return false;
    const kataData = semua.split(" ");
    return kata.every((t) => kataData.some((w) => w.startsWith(t)));
  });
  const awal = norm(q);
  return cocok
    .sort((a, b) => {
      const sa = a.nama.startsWith(awal) ? 0 : 1;
      const sb = b.nama.startsWith(awal) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const ka = a.k.nama.startsWith("Kota") ? 0 : 1;
      const kb = b.k.nama.startsWith("Kota") ? 0 : 1;
      return ka - kb || a.nama.localeCompare(b.nama);
    })
    .slice(0, maks)
    .map((x) => x.k);
}

/** Nama kanonik bila `nama` persis salah satu kab/kota (boleh beda huruf besar/kecil), selain itu null. */
export function kotaSah(nama: string | null | undefined): Kota | null {
  const n = String(nama ?? "").trim().toLowerCase();
  if (!n) return null;
  return SEMUA.find((k) => k.nama.toLowerCase() === n || `${k.nama}, ${k.provinsi}`.toLowerCase() === n) ?? null;
}
