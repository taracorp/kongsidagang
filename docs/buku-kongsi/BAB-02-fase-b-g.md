# BAB 02 — Fase B–G: kerangka fitur (data dummy)

Semua halaman dibangun dulu dengan data dummy (`lib/dummy.ts`, `lib/data-e.ts`). SQL ditulis
tapi **belum di-apply** pada fase ini.

### Ch 2.1 — Fase B: Beranda
`commit 8ff47ea` · `tag kd-fase-b` · 2026-07-04
- **Perubahan:** `app/(kongsi)/page.tsx` (hero, lelang berlangsung, teaser Juru Tunjuk, Etalase, Pilihan Untukmu),
  `components/kongsi/{LiveAuction,RowHead}.tsx`, `lib/dummy.ts`.
- **SQL:** —

### Ch 2.2 — Fase C: Katalog & Loji
`commit 17f3592` · `tag kd-fase-c` · 2026-07-05
- **Perubahan:** `/loji`, `/loji/[slug]`, `/saudagar/daftar` + `SaudagarForm.tsx`.
- **SQL:** `0001_merchants.sql` (merchants, merchant_products, merchant_applications + RLS).

### Ch 2.3 — Fase D: Keranjang & Checkout
`commit ce924d2` · `tag kd-fase-d` · 2026-07-05
- **Perubahan:** `components/kongsi/cart.tsx` (context keranjang tanpa akun), `AddToCartButton.tsx`,
  `/keranjang`, `/bayar` (gate daftar + Supabase auth).
- **SQL:** —

### Ch 2.4 — Fase E: Lelang, Neraca, Tukar, Juru Tunjuk, Kabar
`commit 937f502` · `tag kd-fase-e` · 2026-07-05
- **Perubahan:** `/lelang` (phase switcher, gerbang Vendu), `/neraca`, `/tukar`, `/juru-tunjuk`,
  `/kabar`, `/kabar/[slug]`, `BalaiLelang.tsx` (kelak diganti), `lib/data-e.ts`.
- **SQL:** `0002_auctions`, `0003_price_listings`, `0004_barter`, `0005_articles`.

### Ch 2.5 — Fase F: Auth, Pakhuis, Admin
`commit 82dd772` · `tag kd-fase-f` · 2026-07-05
- **Perubahan:** `/masuk` + `AuthForm.tsx`, `/pakhuis` (Pundi/level/Surat Jalan), `/admin/kongsi` (guard role),
  `LogoutButton.tsx`, `lib/auth.ts`.
- **SQL:** `0006_wallet_admin.sql` (profiles, wallets, vouchers, `is_admin()`).

### Ch 2.6 — Fase G: polish + full-flow test
`commit fddb484` · `tag kd-fase-g` · 2026-07-05
- **Perubahan:** TopBar reaktif sesi login, `scripts/flow.mjs` (`npm run flow`).
- **Verifikasi:** full-flow 11/11 pass (menurut pesan commit).
