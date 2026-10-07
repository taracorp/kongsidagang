# LAMPIRAN — Rollback

Titik rollback = **git tag annotated** `kd-*`. Lihat semua: `git tag -l 'kd-*' -n1`

## Tabel titik rollback

| Tag | Commit | Tanggal | Isi | Migrasi SQL kumulatif |
|---|---|---|---|---|
| `kd-fase-a` | ee64388 | 2026-07-04 | Rangka, tokens, komponen dasar | — |
| `kd-fase-b` | 8ff47ea | 2026-07-04 | Beranda (dummy) | — |
| `kd-fase-c` | 17f3592 | 2026-07-05 | Loji + daftar Saudagar | 0001 |
| `kd-fase-d` | ce924d2 | 2026-07-05 | Keranjang + Bayar gate | 0001 |
| `kd-fase-e` | 937f502 | 2026-07-05 | Lelang/Neraca/Tukar/Juru/Kabar | 0001–0005 |
| `kd-fase-f` | 82dd772 | 2026-07-05 | Auth, Pakhuis, Admin | 0001–0006 |
| `kd-fase-g` | fddb484 | 2026-07-05 | Polish + flow test | 0001–0006 |
| `kd-wiring-db` | 77ef028 | 2026-07-05 | Halaman baca DB | 0001–0006 |
| `kd-panggung` | 85af8ce | 2026-07-06 | Panggung teater + realtime | 0001–0007 |
| `kd-admin-web` | a19cc1a | 2026-07-06 | Fitur #1–#7 + dashboard admin | 0001–0011 |
| `kd-m1` | 6a689ce | 2026-07-06 | Saudagar end-to-end | 0001–0012 |
| `kd-m2` | 4355b3d | 2026-07-06 | Mesin lelang | 0001–0013 |
| `kd-m3` | c7c8a17 | 2026-07-06 | Pundi & Surat Jalan | 0001–0014 |
| `kd-m4` | da10602 | 2026-07-06 | Level & Loyalti | 0001–0015 |
| `kd-m5` | 3935c53 | 2026-07-06 | Tukar Guling matang | 0001–0016 |
| `kd-auth-google` | 1163dc0 | 2026-07-06 | Login Google | 0001–0016 |
| `kd-buku-kongsi` | 3b31848 | 2026-10-05 | Buku Kongsi + tag rollback | 0001–0016 |
| `kd-pre-vps` | 47d4119 | 2026-10-05 | **Versi Supabase terakhir** (sebelum VPS/Prisma) | 0001–0016 (Supabase) |
| `kd-prisma` | e437565 | 2026-10-05 | Prisma + Better Auth, lulus tes lokal | Prisma: init, checks |
| `kd-vps-live` | 8a21fc3 | 2026-10-05 | **Live di https://kongsidagang.store** (pm2 :3020, Traefik, crontab) | Prisma: init, checks |
| `kd-tukar-m1` | d1e3098 | 2026-10-05 | Tukar v2 M1: Keteng, rekber Pundi, paket Isi Pundi | Prisma: init, checks, wallet_holds (dev saja) |
| `kd-tukar-m2` | 9177504 | 2026-10-05 | Tukar v2 M2: Mesin Taksiran | + 20261005135153_taksiran (dev saja) |
| `kd-tukar-m3` | 00045f7 | 2026-10-05 | Tukar v2 M3: kesepakatan, bea, rekber, COD QR | + 20261005140117_tukar_deal (dev saja) |
| `kd-tukar-m4` | 8b6b1ec | 2026-10-06 | Tukar v2 M4: mode Kirim via KiriminAja | + 20261005170606_tukar_kirim (dev saja) |
| `kd-isi-doku` | 4814041 | 2026-10-06 | Isi Pundi lewat DOKU Checkout (produksi) | + 20261006090000_topup_doku |
| `kd-prod-tukar-v2` | c76f4f3 | 2026-10-06 | **Live di produksi**: Tukar Guling v2 (COD) + Isi Pundi DOKU | 7 migrasi Prisma (s/d topup_doku), diterapkan ke `kongsi` |
| `kd-juru-taksir` | d04de82 | 2026-10-06 | Juru Taksir gratis (BigGo + SearXNG) + rumus taksiran baru + tombol sesuai pakem | + 20261006040057_juru_taksir (dev saja) |
| `kd-isi-nominal` | ceab51d | 2026-10-06 | Isi Pundi: nominal favorit + bebas (s/d 50jt) + saran dari kekurangan saldo | (tanpa migrasi) |
| `kd-lapak-evoucher` | 34607e7 | 2026-10-06 | Tenant asli + e-voucher berkode + Loji→Lapak + notifikasi + Kabar berisi | migrasi `20261006120000_lapak_evoucher_notifikasi` |
| `kd-bayar-langsung` | bc2119b | 2026-10-07 | Bayar Langsung: transfer DOKU → Keteng 1:1 → belanja/tukar otomatis | migrasi `20261007090000_bayar_langsung` |
| `kd-platform-fee` | (lihat tag) | 2026-10-07 | Platform fee Rp4.000 + biaya DOKU ditanggung pembeli; belanja pakai uang; Keteng khusus Tukar Guling; tanpa bonus | migrasi `20261007120000_bayar_uang_platform_fee`, `20261007130000_topup_tanpa_bonus` |

## Prosedur

**1. Melihat/mencoba versi lama (aman, tidak mengubah `main`):**
```bash
git switch -c coba-m3 kd-m3
```
Kembali: `git switch main`, lalu hapus cabang coba: `git branch -D coba-m3`.

**2. Rollback kode di `main` tanpa menghapus sejarah (disarankan):**
```bash
git revert --no-edit kd-m3..HEAD
```
Membuat commit pembalik untuk semua perubahan setelah `kd-m3`. Bisa dibatalkan lagi dengan revert commit tersebut.

**3. Reset keras (destruktif — hanya bila Tara minta eksplisit, dan belum di-push):**
`git reset --hard <tag>` — commit sesudahnya hilang dari cabang (masih bisa dicari via `git reflog` beberapa waktu).

## ⚠️ Database tidak ikut ter-rollback

Sejak `kd-pre-vps`, ada **dua dunia DB**: tag ≤ `kd-pre-vps` memakai Supabase cloud (masih hidup);
tag ≥ `kd-prisma` memakai Postgres VPS (`prisma/migrations`). Kembali ke tag Supabase cukup dengan kode
+ `.env.local` lama (kunci `NEXT_PUBLIC_SUPABASE_*`). Untuk migrasi Prisma, batalkan dengan migrasi baru (jangan edit migrasi yang sudah diterapkan).

Rollback kode **tidak** membatalkan migrasi yang sudah di-apply di Supabase. Bila kembali ke tag yang
memakai migrasi lebih sedikit (lihat kolom terakhir), tabel/fungsi baru tetap ada di DB — biasanya
aman (kode lama mengabaikannya). Bila perlu dibatalkan, agen menulis SQL `down` khusus per migrasi,
lalu **Tara apply manual** di SQL Editor. Selalu backup/ekspor data dulu.

## Cara membuat titik baru
```bash
git tag -a kd-<nama> -m "<ringkasan>"
```
Lalu tambah baris di tabel di atas + Chapter di Bab aktif.
