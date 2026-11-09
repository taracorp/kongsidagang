"use client";

// Bang Kongsi — tokoh juru lelang (host) bergaya saudagar nusantara untuk panggung lelang.
// SVG inline berlapis supaya tiap bagian (kepala, mata, mulut, lengan, palu) digerakkan CSS.
// Gerakan dipilih lewat prop `gerak`; mulut bergerak saat `bicara`. Warna mengikuti palet Kongsi.
// Animasi ada di app/globals.css (bagian "Bang Kongsi"); hormati prefers-reduced-motion.

export type GerakBang =
  | "diam" // bernapas + kedip (dasar)
  | "lambai" // melambai — fase kumpul
  | "tunjuk" // menunjuk kartu clue
  | "nonton" // tangan di dahi — slide TVC
  | "palu" // mengetuk palu — slide tebak
  | "menang" // kaget lalu tepuk — pemenang
  | "bisik"; // tangan di mulut — lelang khusus

export function BangKongsi({
  gerak = "diam",
  bicara = false,
  size = 180,
  className = "",
  title = "Bang Kongsi",
}: {
  gerak?: GerakBang;
  bicara?: boolean;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={`bang ${className}`}
      data-gerak={gerak}
      data-bicara={bicara ? "1" : "0"}
      width={size}
      height={size}
      viewBox="0 0 220 220"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* bayangan lantai */}
      <ellipse cx="110" cy="204" rx="62" ry="9" fill="rgba(14,53,67,0.28)" />

      {/* seluruh tokoh bernapas */}
      <g className="bk-all">
        {/* ===== Lengan kiri (his right) — memegang palu ===== */}
        <g className="bk-arm-gavel">
          <rect x="150" y="116" width="20" height="52" rx="10" fill="#d0451f" />
          <rect x="150" y="116" width="20" height="52" rx="10" fill="rgba(0,0,0,0.12)" />
          {/* tangan */}
          <circle cx="160" cy="150" r="12" fill="#e0a878" />
          {/* palu lelang */}
          <g className="bk-gavel">
            <rect x="150" y="120" width="44" height="14" rx="5" fill="#8a5a2b" />
            <rect x="150" y="120" width="44" height="14" rx="5" fill="rgba(255,255,255,0.12)" />
            <rect x="166" y="128" width="9" height="40" rx="4" fill="#6a4320" />
          </g>
        </g>

        {/* ===== Lengan kanan (his left) — melambai / menunjuk ===== */}
        <g className="bk-arm-wave">
          <rect x="48" y="118" width="20" height="50" rx="10" fill="#d0451f" />
          <rect x="48" y="118" width="20" height="50" rx="10" fill="rgba(0,0,0,0.12)" />
          <circle cx="58" cy="150" r="12" fill="#e0a878" />
        </g>

        {/* ===== Badan: rompi + baju ===== */}
        <g className="bk-body">
          {/* baju parchment */}
          <path
            d="M70 150 Q110 130 150 150 L160 205 L60 205 Z"
            fill="#fbedd2"
          />
          {/* rompi grenadine */}
          <path d="M84 138 Q110 128 136 138 L146 205 L74 205 Z" fill="#d0451f" />
          <path d="M84 138 Q110 128 136 138 L146 205 L74 205 Z" fill="rgba(0,0,0,0.06)" />
          {/* belahan rompi + kancing */}
          <path d="M110 134 L110 205" stroke="#a9370f" strokeWidth="3" />
          <circle cx="110" cy="158" r="3" fill="#e7a24a" />
          <circle cx="110" cy="174" r="3" fill="#e7a24a" />
          <circle cx="110" cy="190" r="3" fill="#e7a24a" />
          {/* selempang sarung kotak-kotak */}
          <path d="M74 182 L146 182 L150 196 L70 196 Z" fill="#16495d" />
          <path
            d="M74 182 L146 182 L150 196 L70 196 Z"
            fill="url(#bk-plaid)"
            opacity="0.5"
          />
        </g>

        {/* leher */}
        <rect x="100" y="112" width="20" height="18" rx="7" fill="#e0a878" />
        <rect x="100" y="112" width="20" height="10" fill="rgba(0,0,0,0.08)" />

        {/* ===== Kepala (mengangguk/goyang) ===== */}
        <g className="bk-head">
          {/* wajah */}
          <circle cx="110" cy="84" r="40" fill="#e8b488" />
          <circle cx="110" cy="84" r="40" fill="url(#bk-cheek)" />
          {/* telinga */}
          <circle cx="71" cy="86" r="8" fill="#e0a878" />
          <circle cx="149" cy="86" r="8" fill="#e0a878" />

          {/* alis */}
          <rect className="bk-brow" x="86" y="68" width="18" height="5" rx="2.5" fill="#3a2417" />
          <rect className="bk-brow" x="116" y="68" width="18" height="5" rx="2.5" fill="#3a2417" />

          {/* mata (kedip) */}
          <g className="bk-eyes">
            <circle cx="95" cy="82" r="5.5" fill="#3a2417" />
            <circle cx="125" cy="82" r="5.5" fill="#3a2417" />
            <circle cx="96.6" cy="80.4" r="1.7" fill="#fff" />
            <circle cx="126.6" cy="80.4" r="1.7" fill="#fff" />
          </g>

          {/* hidung */}
          <path d="M110 86 q5 6 0 11 q-4 1 -6 -1" fill="#d99a66" />

          {/* kumis */}
          <path
            d="M110 102 Q96 98 84 104 Q95 108 110 104 Q125 108 136 104 Q124 98 110 102 Z"
            fill="#3a2417"
          />

          {/* mulut (bergerak saat bicara) */}
          <g className="bk-mouth-wrap">
            <path className="bk-mouth" d="M100 110 Q110 116 120 110" fill="none" stroke="#7a3b1f" strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* ===== Peci / songkok ===== */}
          <path d="M74 66 Q110 40 146 66 Q148 58 110 48 Q72 58 74 66 Z" fill="#16495d" />
          <path d="M72 66 L148 66 L148 60 Q110 50 72 60 Z" fill="#0e3543" />
          {/* motif emas peci */}
          <path d="M80 62 Q110 52 140 62" fill="none" stroke="#e7a24a" strokeWidth="2.5" strokeDasharray="2 5" />
        </g>
      </g>

      <defs>
        <radialGradient id="bk-cheek" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0.7" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(208,69,31,0.12)" />
        </radialGradient>
        <pattern id="bk-plaid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 0 H10 M0 5 H10 M0 0 V10 M5 0 V10" stroke="#e7a24a" strokeWidth="1" />
        </pattern>
      </defs>
    </svg>
  );
}
