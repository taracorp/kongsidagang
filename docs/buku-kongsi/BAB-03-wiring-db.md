# BAB 03 — Wiring DB, Panggung Teater, Admin & Fitur #1–#7

### Ch 3.1 — `apply_all.sql`
`commit ee8b25f` · 2026-07-05
- Gabungan migrasi berurutan dalam satu file (awalnya 0001–0006; kini memuat 0001–0016).

### Ch 3.2 — Wiring Supabase: halaman baca DB asli
`commit 77ef028` · `tag kd-wiring-db` · 2026-07-05
- **Perubahan:** `lib/queries.ts` (lapisan data, **fallback ke dummy** bila DB kosong/gagal),
  Beranda/loji/neraca/tukar/kabar membaca DB, `scripts/seed.mjs` (`npm run seed`).

### Ch 3.3 — Lelang & Pakhuis nyata
`commit 9a8e8fd` · 2026-07-05
- `/lelang` baca `auction_items_public` + ikut/tebak ke DB (`LelangLive.tsx` menggantikan `BalaiLelang.tsx`);
  `/pakhuis` baca wallet/level/voucher.

### Ch 3.4 — Admin fungsional
`commit aa51ee9` · 2026-07-05
- `/admin/kongsi` baca auctions (harga rahasia + margin via RLS) + `ApplicationsAdmin.tsx` (approve/reject Saudagar).

### Ch 3.5 — LiveDot & Sekilas Pariwara
`commit 6acd2f1`, `f4c02bc`, `133472e` · 2026-07-05
- Titik live berkedip; Beranda otomatis kartu lelang ↔ Sekilas Pariwara; admin kontrol status lelang
  (`AuctionStatusSelect.tsx`) + `PariwaraForm.tsx`.
- **SQL:** `0007_settings.sql`.

### Ch 3.6 — App-shell mobile-first
`commit ad069c5`, `ea19e1b` · 2026-07-05
- Frame 480px terpusat; bottom-nav & grain di-scope ke frame; admin tetap lebar penuh; stack layout mobile.

### Ch 3.7 — Panggung teater (Tahap 1–3)
`commit 7b22468`, `38a8dd5`, `85af8ce` · `tag kd-panggung` · 2026-07-05/06
- `Panggung.tsx`, `TheatreLelang.tsx`: tirai beludru, spotlight, confetti; carousel barang (autoplay 9s);
  **Realtime Broadcast** kanal `kongsi-lelang` → penonton auto-refresh tanpa reload.

### Ch 3.8 — Fitur #1 Tukar Guling fungsional
`commit 68087c4` · 2026-07-06
- `/tukar/tawarkan` + `TawarkanForm.tsx`, `BarterActions.tsx` (ajukan/terima/tolak/selesai).
- **SQL:** `0008_barter_deal_update.sql`.

### Ch 3.9 — Fitur #5 Neraca search + #7 Ikuti Loji
`commit 30ea8d8` · 2026-07-06
- Neraca `GET ?q` dari `merchant_products`; `FollowButton.tsx`. **SQL:** `0009_follows.sql` (sudah apply).

### Ch 3.10 — Fitur #2 Juru Tunjuk nyata
`commit bd6045c` · 2026-07-06
- Hasil kuis dari `merchant_products` by tag + kisaran harga; seed produk bertag.

### Ch 3.11 — Fitur #6 Admin Kabar (CMS)
`commit 51c4399` · 2026-07-06
- `KabarAdmin.tsx`: buat/terbit/tarik/hapus artikel.

### Ch 3.12 — Fitur #4 Timer lelang otomatis
`commit 934ea54` · 2026-07-06
- **SQL:** `0010_auto_lelang.sql` — pg_cron + `advance_auctions()` tiap menit + `realtime.send` (sudah apply).

### Ch 3.13 — Dashboard admin web + peran
`commit a19cc1a` · `tag kd-admin-web` · 2026-07-06
- `app/admin/*` (ringkasan + grafik SVG, lelang, saudagar, neraca, kabar, peran), `AdminShell.tsx`
  (sidebar collapsible, guard per-route), `RoleManager.tsx`, `lib/roles.ts`. `/admin/kongsi` → redirect `/admin`.
- Peran: Pelanggan, Saudagar, Pewarta, Admin Kongsi, Ketua Kongsi (maks 2).
- **SQL:** `0011_staff_roles.sql` (staff_roles, `is_admin_up`, `is_ketua`, `can_edit_kabar`, trigger maks 2 ketua).
