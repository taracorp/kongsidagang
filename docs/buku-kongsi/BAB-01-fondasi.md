# BAB 01 — Fondasi

### Ch 1.1 — Commit pertama & setup Next.js 16 + Supabase
`commit 0a20cd2`, `dada699`, `761d8ec` · 2026-07-04

- **Tujuan:** kerangka project standalone `taracorp/kongsidagang`.
- **Perubahan:** `app/layout.tsx`, `app/globals.css`, `lib/supabase/{client,server,middleware}.ts`,
  `proxy.ts` (refresh sesi Supabase — konvensi Next 16), `AGENTS.md`/`CLAUDE.md`, `.env.local.example`.
- **SQL:** —
- **Rollback:** titik paling awal; tidak ada tag (kembali ke sini = mulai ulang).

### Ch 1.2 — Fase A: rangka Kongsi Dagang
`commit ee64388` · `tag kd-fase-a` · 2026-07-04

- **Tujuan:** design tokens "Rempah & Samudera", font, chrome aplikasi, komponen dasar.
- **Perubahan:** `AGENTS.md` (panduan v2.0), `app/globals.css` (token `@theme`), `app/(kongsi)/layout.tsx`,
  `components/kongsi/{TopBar,BottomNav,KongsiButton,Pill,PintuCard,ProdukCard,icons}.tsx`,
  `lib/utils.ts` (`cn`, `formatKeping`), `/kongsi-kit` (galeri komponen),
  `reference/kongsi-dagang-mockup-v2.html`.
- **SQL:** —
- **Rollback:** `kd-fase-a` = rangka bersih tanpa fitur.

### Ch 1.3 — Workflow screenshot
`commit 29d6226` · 2026-07-04

- **Perubahan:** `scripts/shot.mjs`, `npm run shot` (Playwright; hasil `reference/shot-*.png`, di-ignore git).
