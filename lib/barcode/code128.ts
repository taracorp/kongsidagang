// Barcode Code 128 → SVG (tanpa dependensi). Default set A, sesuai syarat label KiriminAja ("AWB 128A").
// Karakter di luar set A (huruf kecil dll.) otomatis memakai set B.
// Pola lebar bar/spasi (b s b s b s) untuk nilai 0–106; 106 = STOP (7 elemen).

const POLA = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_A = 103;
const START_B = 104;
const STOP = 106;

/** Nilai simbol (start, data, checksum, stop) untuk teks. */
export function nilaiCode128(teks: string): number[] {
  const kode = [...teks].map((c) => c.charCodeAt(0));
  if (kode.some((k) => k < 0 || k > 127)) throw new Error("Code128: karakter tidak didukung.");
  // Set A: ASCII 32–95 (nilai k-32) dan kontrol 0–31 (nilai k+64). Set B: ASCII 32–127 (nilai k-32).
  const pakaiA = kode.every((k) => k <= 95);
  const start = pakaiA ? START_A : START_B;
  const data = kode.map((k) => (pakaiA && k < 32 ? k + 64 : k - 32));
  if (!pakaiA && kode.some((k) => k < 32)) throw new Error("Code128: karakter kontrol butuh set A.");
  const cek = (start + data.reduce((s, v, i) => s + v * (i + 1), 0)) % 103;
  return [start, ...data, cek, STOP];
}

/** SVG barcode. `modul` = lebar 1 modul (px), `tinggi` = tinggi bar (px). Termasuk quiet zone 10 modul. */
export function svgCode128(teks: string, opsi: { modul?: number; tinggi?: number } = {}): string {
  const modul = opsi.modul ?? 2;
  const tinggi = opsi.tinggi ?? 60;
  const lebar = nilaiCode128(teks).map((v) => POLA[v]).join("");
  let x = 10 * modul;
  const rects: string[] = [];
  [...lebar].forEach((w, i) => {
    const px = Number(w) * modul;
    if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${px}" height="${tinggi}"/>`);
    x += px;
  });
  const total = x + 10 * modul;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${tinggi}" width="${total}" height="${tinggi}" shape-rendering="crispEdges" role="img" aria-label="Barcode ${teks.replace(/[<>&"]/g, "")}"><rect width="${total}" height="${tinggi}" fill="#fff"/><g fill="#000">${rects.join("")}</g></svg>`;
}
