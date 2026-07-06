# Kongsi Dagang — Roadmap

Acuan arah pengembangan. Status per fase ditandai: ✅ selesai · 🚧 jalan · ⬜ belum.

## 0. Fondasi (✅ live)
- Next.js 16 + Supabase, app mobile-first (frame 480) + dashboard admin web.
- Halaman: Beranda, Lelang (panggung teater + realtime + auto-timer), Neraca (search),
  Tukar Guling (fungsional), Loji/detail (+follow), Juru Tunjuk (real), Kabar + CMS,
  Keranjang, Bayar (gate daftar), Pakhuis (wallet/level/voucher), Masuk.
- Peran: Pelanggan, Saudagar, Pewarta, Admin Kongsi, Ketua Kongsi (maks 2).
- DB + RLS, pg_cron auto-advance lelang, realtime broadcast, deploy Vercel.

---

## 1. Milestone fungsional inti

### M1 — Saudagar end-to-end ✅
- Approve pengajuan → **auto-buat loji + set owner + cap segel**.
- **Lapak-ku** (`/lapak`): Saudagar kelola loji & **CRUD produk** sendiri.
- Produk otomatis masuk katalog & Neraca.

### M2 — Mesin Lelang sungguhan ✅
- Durasi per-fase, **hitung pemenang** (tebakan terdekat ke `set_price`), `winner_id`.
- Peserta live, kunci tebakan per babak, **terbit Surat Jalan** ke pemenang.
- Vendu khusus login + level.

### M3 — Pundi & Surat Jalan ✅
- **Ledger transaksi** keping, potong saldo saat menebus.
- Voucher terbit otomatis (menang/tebus) + **redeem** berfungsi.

### M4 — Level & Loyalti ✅
- Ambang level Pelanggan Kecil→Juragan (naik otomatis dari akumulasi).
- Hak per-level (Vendu tanpa antre, potongan bea). Cap didapat & ditukar.

### M5 — Tukar Guling matang ✅
- Foto barang (Storage), rating antar pihak, **sengketa → Syahbandar** (UI admin).

---

## 2. Payment (ditunda)
### M6 — DOKU/Pembayaran ⬜
- Checkout asli, **Isi Pundi** (top-up), settlement Saudagar, webhook.

---

## 3. Konten & Penemuan ⬜
- **Storage**: gambar produk, cover artikel, avatar loji.
- Kabar: editor kaya + gambar + halaman per-tag.
- Search & filter global (produk/loji/kategori).
- Notifikasi nyata (ikon lonceng masih statis).

---

## 4. Lintas-cutting (sebelum produksi) ⬜
- Keamanan: rotate kredensial, audit RLS, service_role hanya server, rate-limit.
- Auth: Site URL/redirect domain live, lupa sandi, verifikasi email, OAuth/telepon.
- Observability: error tracking, log, analytics.
- Testing/CI: `npm run flow` + tsc/eslint via GitHub Actions.
- Legal/ops: ToS, privasi, perjanjian Saudagar.
- PWA (di-hold) + SEO/OG.

---

## 5. Urutan disarankan
1. M1 Saudagar → ekosistem penjual.
2. M2 Lelang sungguhan + M3 Pundi/Voucher → loop nilai inti.
3. M4 Level + M5 Tukar matang → retensi.
4. Storage + Search + Notifikasi → pengalaman.
5. Keamanan/Auth/CI/Observability → siap produksi.
6. M6 Payment + PWA → monetisasi & distribusi.

---

## Prinsip tetap
- Mata uang tunggal **Keping (1 = Rp 1)**, tanpa Gulden.
- "Masuk tanpa identitas": jelajah + keranjang tanpa login; daftar hanya saat menebus.
- Harga rahasia lelang (deal/set) tak pernah bocor ke publik (via `auction_items_public`).
