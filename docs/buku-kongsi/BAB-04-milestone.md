# BAB 04 — Milestone M1–M5 + Login Google

Mengikuti [ROADMAP.md](../../ROADMAP.md) bagian 1.

### Ch 4.1 — M1 Saudagar end-to-end
`commit 6a689ce` · `tag kd-m1` · 2026-07-06
- Approve pengajuan → RPC auto-buat loji (owner + cap segel); `/lapak` (Lapak-ku) + `ProdukManager.tsx` CRUD produk.
- **SQL:** `0012_approve_merchant.sql`. ROADMAP.md dibuat di commit ini.

### Ch 4.2 — M2 Mesin Lelang sungguhan
`commit 4355b3d` · `tag kd-m2` · 2026-07-06
- `decide_auction()` (tebakan terdekat ke `set_price`) + terbit Surat Jalan; reveal harga asli/pemenang/selisih;
  peserta live via view; `advance_auctions` auto-putus di fase pemenang.
- **SQL:** `0013_auction_engine.sql`.

### Ch 4.3 — M3 Pundi & Surat Jalan
`commit c7c8a17` · `tag kd-m3` · 2026-07-06
- Ledger `wallet_transactions`, `spend_keping`, `topup_demo` (Isi Pundi **demo**), `redeem_voucher`;
  `PundiActions.tsx`; `/bayar` bayar dengan Keping.
- **SQL:** `0014_pundi_ledger.sql`.

### Ch 4.4 — M4 Level & Loyalti
`commit da10602` · `tag kd-m4` · 2026-07-06
- `checkout_keping` (potongan bea per-level & Cap), `recompute_level` naik otomatis; `BayarClient.tsx`
  (deteksi login server-side); progres level di Pakhuis.
- **SQL:** `0015_level_loyalti.sql`.

### Ch 4.5 — M5 Tukar Guling matang
`commit 3935c53` · `tag kd-m5` · 2026-07-06
- Foto barang (Storage bucket `barter`), `rate_deal` + bintang, sengketa → Syahbandar (`/admin/tukar`, `DisputeResolve.tsx`).
- **SQL:** `0016_tukar_matang.sql`.

### Ch 4.6 — Login dengan Google
`commit 1163dc0` · `tag kd-auth-google` · 2026-07-06
- `signInWithOAuth` + `app/auth/callback/route.ts`; `GoogleButton.tsx` di `/masuk` & `/bayar`.
  Site URL + redirect URL diset di Supabase.
- **SQL:** —
