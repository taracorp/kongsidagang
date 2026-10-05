# BAB 00 — Pendahuluan

## Ch 0.1 — Apa itu Kongsi Dagang
Pasar daring bergaya kongsi dagang tempo dulu: Balai Lelang tebak-harga, Tukar Guling (barter),
Neraca Harga (banding harga), Loji Saudagar (toko), Juru Tunjuk (pemandu belanja), Kabar (artikel),
dompet **Pundi** berisi **Keping** (1 Keping = Rp 1), voucher **Surat Jalan**, dan tangga level
Pelanggan Kecil → Juragan.

## Ch 0.2 — Prinsip yang dikunci
- **"Masuk gedung tua tanpa diminta identitas"** — jelajah, lelang reguler, keranjang tanpa login;
  daftar hanya saat menebus (`/bayar`). Vendu khusus user login.
- Mata uang tunggal **Keping** (tanpa Gulden). Panjar/persekot **tidak** dipakai.
- Harga rahasia lelang (deal/set) tidak pernah bocor ke publik (view `auction_items_public`).
- SQL & edge function di-apply/deploy **manual oleh Tara**.
- Acuan lengkap: [AGENTS.md](../../AGENTS.md) (Kamus Kongsi, tokens, aturan kerja) dan
  [ROADMAP.md](../../ROADMAP.md).

## Ch 0.3 — Tech stack
| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16.2 (App Router, `proxy.ts` pengganti middleware), React 19.2 |
| Gaya | Tailwind v4 (`@theme` token `kongsi-*` di `app/globals.css`), Fraunces + Work Sans |
| Backend | Supabase (`dilwxkgmjdrjkruajxli`): Postgres + RLS, Auth (email + Google), Storage, Realtime Broadcast, pg_cron |
| Tooling | TypeScript 5, ESLint 9, Playwright (`npm run shot`, `npm run flow`), `npm run seed` |
| Deploy | Vercel (`npx vercel --prod`) |

## Ch 0.4 — Struktur repo
```
app/(kongsi)/     16 halaman publik (frame mobile 480px, TopBar + BottomNav)
app/admin/        Kantor Kongsi: ringkasan, lelang, saudagar, neraca, kabar, tukar, peran
app/lapak/        Lapak-ku (Saudagar kelola produk)
app/auth/callback OAuth exchange code
components/kongsi/  UI publik · components/admin/  UI admin
lib/              queries.ts (lapisan data), auth.ts, roles.ts, utils.ts, dummy.ts, data-e.ts
lib/supabase/     client.ts (browser), server.ts, middleware.ts (updateSession)
supabase/         migrations/0001–0016 + apply_all.sql (gabungan)
scripts/          seed.mjs, flow.mjs, shot.mjs
reference/        mockup v2 + screenshot review
docs/buku-kongsi/ buku ini
```
