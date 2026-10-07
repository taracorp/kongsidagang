"use client";

/** Tombol cetak label (disembunyikan saat dicetak). */
export function TombolCetak() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="cetak-sembunyi cursor-pointer rounded-[3px] border-2 border-kongsi-ink bg-kongsi-grenadine px-4 py-2 text-sm font-bold text-kongsi-parchment shadow-hard-sm"
    >
      Cetak label
    </button>
  );
}
