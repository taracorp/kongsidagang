# BAB 08 — Pindah ke VPS & Prisma (Bab aktif)

Tujuan bab ini: lepas dari Supabase cloud. Database, auth, file, realtime, dan cron berjalan
sendiri di VPS **31.97.49.146** dengan **Prisma 7**, domain **kongsidagang.store**.
Keputusan Tara (5 Okt 2026): auth = Better Auth · data = mulai bersih + seed · deploy = pola pm2 +
Traefik yang sudah ada di VPS, cukup atur port.

### Ch 8.1 — Koreksi laporan BAB 06 (Ch 6.4 #1)
2026-10-05
- Ch 6.4 #1 menyebut "32 commit belum di-push". **Keliru**: penanda `origin/main` di laptop sudah lama
  tidak diperbarui. GitHub ternyata sudah berisi sampai `1163dc0`. Yang belum ter-push hanya 2 commit
  buku (`3b31848`, `47d4119`), dan kini sudah di-push bersama semua tag `kd-*`.
- `origin` diganti ke SSH `git@github-taracorp:taracorp/kongsidagang.git` (kunci `id_ed25519_taracorp`).

### Ch 8.2 — P0 Persiapan
`tag kd-pre-vps` (= `47d4119`, versi Supabase terakhir) · 2026-10-05
- Container `kongsi-db` (postgres:16-alpine, `127.0.0.1:5434`, volume `kongsi-db-data`,
  restart unless-stopped). Kredensial ada di `/root/kongsi-db.env` (VPS, chmod 600).
- Database: `kongsi` (produksi) dan `kongsi_dev` (dev). Dev lokal lewat tunnel SSH.
- Supabase cloud **tidak disentuh** dan masih jalan, jadi bisa kembali kapan saja lewat `kd-pre-vps`.

### Ch 8.3 — P1 Skema Prisma
- `prisma/schema.prisma`: 18 tabel lama (nama kolom snake_case tetap) + 4 tabel Better Auth
  (`user`, `session`, `account`, `verification`). Enum `user_level`, `staff_role`.
- `prisma.config.ts` (Prisma 7: URL DB di config, baca `.env.local` lalu `.env`); `lib/db.ts` (adapter `@prisma/adapter-pg`).
  Client ter-generate ke `lib/generated/prisma` (di-ignore git; `postinstall` = `prisma generate`).
- Migrasi: `20261005070640_init`, `20261005070705_checks` (CHECK bintang 1–5, saldo ≥ 0,
  trigger maks 2 Ketua, setting awal Pariwara).
- Prisma 8 masih RC dan belum didukung Better Auth → dipakai **7.10.0**.

### Ch 8.4 — P2 Auth: Better Auth
- `lib/auth.ts` (server: `auth`, `getSessionUser()`, `requireUser()`), `lib/auth-client.ts`,
  `app/api/auth/[...all]/route.ts`. Hook `user.create.after` membuat profil + Pundi (pengganti trigger `handle_new_user`).
- Diganti: `AuthForm`, `GoogleButton`, `LogoutButton`, `TopBar` (`useSession`), `/masuk`, `/bayar`, `BayarClient`.
- Dihapus: `proxy.ts`, `app/auth/callback`, `lib/supabase/`.
- Google aktif hanya bila `GOOGLE_CLIENT_ID/SECRET` diisi. Redirect URI: `https://kongsidagang.store/api/auth/callback/google`.

### Ch 8.5 — P3 Lapisan baca
- `lib/queries.ts` ditulis ulang dengan Prisma. **Signature fungsi tetap**, jadi halaman tidak berubah.
- Pengganti view `auction_items_public`: `getPublicAuctionItems()`. `deal_price` tidak pernah di-select;
  `set_price` hanya dibuka pada fase pemenang/bayar/selesai.
- Filter yang dulu dijaga RLS kini eksplisit: deal Tukar hanya milik pihak terkait, artikel publik hanya
  yang sudah terbit, data admin dicek peran (`getStaffSession`).
- Setiap fungsi memanggil `await connection()` di luar `try`, supaya Beranda/Kabar/Loji tidak
  diprerender saat build (dulu otomatis dinamis karena cookie Supabase).

### Ch 8.6 — P4 Lapisan tulis & logika bisnis
- `lib/domain/lelang.ts` (decideAuction, advanceAuctions, setAuctionStatus), `lib/domain/pundi.ts`
  (topupDemo, redeemVoucher, checkoutKeping + kunci baris `FOR UPDATE`, levelFor),
  `lib/domain/saudagar.ts` (approveMerchantApplication). Port 1:1 dari plpgsql.
- `app/actions/{lelang,pundi,tukar,loji,admin}.ts`: semua tulis data lewat Server Actions dengan cek
  login/peran/pemilik. 16 komponen client tidak lagi mengakses DB langsung.
- **Perubahan perilaku:**
  - Isi Pundi demo hanya aktif bila `ENABLE_TOPUP_DEMO=true`; produksi default `false` (menutup risiko Ch 6.4 #2).
  - Admin mengubah status lelang kini memicu efek yang sama dengan cron: masuk `pemenang` → putuskan
    pemenang + terbit Surat Jalan; masuk `kumpul` → reset tebakan & peserta.
  - Ajukan tukar menolak barang sendiri atau barang yang sudah tidak aktif.

### Ch 8.7 — P5 Realtime, cron, unggahan
- SSE `app/api/lelang/stream` + `lib/realtime.ts` (EventEmitter, cukup untuk 1 instance pm2) menggantikan
  Supabase Broadcast di `TheatreLelang`.
- `POST /api/cron/advance-auctions` (Bearer `CRON_SECRET`) menggantikan pg_cron; dipanggil crontab VPS tiap menit.
- Foto Tukar Guling: `lib/uploads.ts` → `UPLOAD_DIR` (JPG/PNG/WEBP/GIF, maks 5 MB), disajikan
  `app/uploads/[...path]` (aman dari path traversal). `serverActions.bodySizeLimit = 6mb`.

### Ch 8.8 — P6 Bersih-bersih + verifikasi lokal
`commit e437565` · `tag kd-prisma` · 2026-10-05
- `supabase/` → `docs/arsip-supabase/` (referensi). Dependensi `@supabase/*` dihapus.
- `scripts/seed.mjs` → `prisma/seed.ts` (`npm run seed`; akun awal dari `SEED_ADMIN_*` jadi Ketua, `SEED_TESTER_*` opsional).
- `scripts/flow.mjs` diperluas jadi 18 cek; `scripts/deploy.sh` disiapkan.
- AGENTS.md (aturan kerja DB/deploy baru), README, `.env.local.example` diperbarui.
- **Verifikasi (build produksi lokal + DB `kongsi_dev`):** `tsc` ✅, `lint` ✅, `build` ✅,
  `npm run flow` **18/18 PASS** (tamu + keranjang, gate bayar, harga rahasia tidak bocor, Juru Tunjuk,
  cron 401 tanpa secret, login, tebak, bayar Keping, unggah foto Tukar, Vendu login vs tamu).
  Cek manual: daftar akun baru → profil + Pundi terbentuk; cron memajukan 3 lelang + SSE menerima event;
  7 halaman admin 200 untuk Ketua; non-staf tidak melihat harga rahasia.
- Bug yang ketemu & diperbaiki: `router.refresh()` setelah `router.push()` membatalkan navigasi
  sesudah unggah Tukar; seed penguji ber-level `tuan_kecil` tanpa `total_spend` (turun level setelah belanja).
- **Rollback:** `kd-pre-vps` (kode Supabase). Untuk VPS: `docker rm -f kongsi-db` (+ `docker volume rm kongsi-db-data`).

### Ch 8.9 — P7 Live di VPS: https://kongsidagang.store
`commit 8a21fc3` · `tag kd-vps-live` · 2026-10-05
- **Aplikasi:** `/var/www/kongsidagang` (clone `taracorp/kongsidagang`), `.env` produksi (chmod 600, secret dibuat
  di VPS; `ENABLE_TOPUP_DEMO=false`, `UPLOAD_DIR=/var/www/kongsidagang-uploads`). pm2 `kongsidagang` (port 3020, sudah `pm2 save`).
- **DB produksi** `kongsi`: `prisma migrate deploy` (init + checks) + seed katalog. Akun Ketua Kongsi:
  `taradfworkspace@gmail.com` (sandi awal ada di `.env` VPS → `SEED_ADMIN_PASSWORD`; ganti setelah masuk).
- **Route:** `/data/coolify/proxy/dynamic/kongsidagang.yml`. Entrypoint proxy ini bernama `http`/`https`
  (bukan `web`/`websecure`). Gateway host yang terjangkau dari `coolify-proxy` = **172.16.0.1** (bukan 172.17.0.1).
  `http://` dan `www.` di-redirect 308 ke `https://kongsidagang.store`. Sertifikat Let's Encrypt aktif.
- **Crontab root:** `* * * * * /root/kongsi-cron.sh` (timer lelang → `/api/cron/advance-auctions`) dan
  `15 3 * * * /root/kongsi-backup.sh` (`pg_dump` + tar unggahan → `/root/backups/kongsi`, simpan 7 hari). Backup pertama sudah dibuat.
- **Update berikutnya:** push ke GitHub, lalu di VPS `bash /var/www/kongsidagang/scripts/deploy.sh`.
- **Verifikasi produksi:** `npm run flow` dengan `SHOT_BASE=https://kongsidagang.store KD_SKIP_AUTH=1` → 10/10 PASS
  (alur tamu, gate bayar, harga rahasia aman, Vendu terkunci, cron 401). Login Ketua → `/pakhuis`; `/admin`, `/admin/lelang`,
  `/admin/peran` 200. SSE lewat Traefik menerima event dari crontab. halobugar/beautifio/berkampanye tetap 200/307.
- **Belum:** login Google (menunggu `GOOGLE_CLIENT_ID/SECRET`; client lama di Supabase = project Google Cloud nomor `247112782471`).
- **Rollback:** `pm2 delete kongsidagang && pm2 save`, hapus `kongsidagang.yml` dan dua baris crontab kongsi.
  Kode Supabase tetap ada di tag `kd-pre-vps`.

### Ch 8.10 — Superadmin: taradfworkspace@gmail.com
2026-10-05
- **Tujuan:** akun pemilik tidak boleh kehilangan akses Kantor Kongsi.
- **Perubahan:** env `SUPERADMIN_EMAILS` (pisah koma). Email di daftar ini **selalu** dianggap Ketua Kongsi
  (`lib/roles.ts` → `isSuperadminEmail`, `StaffSession.isSuper`), walau baris `staff_roles`-nya dihapus.
  `aturPeran` menolak mengubah atau mencabut peran Superadmin. Dulu Ketua lain hanya dikunci di UI; sekarang dijaga di server.
  Label "Superadmin" tampil di header admin dan di tabel Atur Peran.
- Produksi: `SUPERADMIN_EMAILS=taradfworkspace@gmail.com` di `.env` VPS.
- **SQL:** —
- **Rollback:** kosongkan `SUPERADMIN_EMAILS` lalu restart pm2 (akun tetap Ketua lewat `staff_roles`).

### Ch 8.11 — Login Google aktif
2026-10-05
- **Masalah:** tombol "Masuk dengan Google" tidak bekerja. Log: `Provider not found { provider: 'google' }`,
  karena `GOOGLE_CLIENT_ID/SECRET` di `.env` VPS masih kosong.
- **Google Cloud:** memakai OAuth client lama (project `247112782471`). Redirect URI diganti Tara menjadi
  `https://kongsidagang.store/api/auth/callback/google`, origin `https://kongsidagang.store`. Diuji: URI baru diterima Google,
  callback Supabase lama sudah ditolak.
- **Perubahan:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` diisi di `.env` VPS (tidak di-commit), lalu `pm2 restart --update-env`.
- **Verifikasi:** `POST /api/auth/sign-in/social` mengembalikan URL Google dan Google mengarahkan ke halaman pilih akun.
  Akun email yang sama (mis. Ketua) otomatis tersambung karena Google mengirim `email_verified`.
- **Catatan:** pastikan Audience/consent screen berstatus *In production*, bukan *Testing*, agar semua orang bisa login.
- **Rollback:** kosongkan dua variabel itu lalu `pm2 restart kongsidagang --update-env` (login Google mati, email tetap jalan).

### Ch 8.12 — Tukar Guling v2, M1: Keteng, rekber Pundi, paket Isi Pundi
2026-10-05
- **Rencana besar (disetujui Tara):** Tukar Guling v2 dalam 5 milestone.
  - M1: Keteng + ledger.
  - M2: mesin taksiran.
  - M3: state machine, bea, COD QR.
  - M4: kirim via Biteship.
  - M5: sengketa, deposit, KYC, reputasi.
- **Keputusan:**
  - Bea Tukar = 10% taksiran barang sendiri, maks 10.000 Keteng, **kedua pihak** bayar.
  - Rekber diizinkan (AGENTS.md §6.1 diperbarui).
  - Deposit 10% (min 5rb, maks 200rb) hanya untuk mode Kirim.
  - KYC hanya untuk mode Kirim atau nilai > 1jt.
  - DOKU masih demo.
  - Kurir: Biteship.
  - Di luar lingkup: barter segitiga, bundling, iklan, scraper, Hub.
- **Istilah:** UI memakai **"Keteng"** di semua tempat (sebelumnya "Keping"). Nama kode `balance`/`formatKeping` tetap. Kamus di AGENTS.md diperbarui.
- **Perubahan:**
  - `lib/domain/pundi.ts`: helper ledger `credit`, `debit`, `hold`, `captureHold`, `releaseHold`, `refundHold`.
    Semua mengunci baris Pundi dengan `FOR UPDATE`. `checkoutKeping` dan `topupDemo` kini memakai helper ini.
  - Model `WalletHold` (`wallet_holds`): Keteng rekber yang sudah dipotong dari saldo, dengan status
    `ditahan|diambil|dilepas|dikembalikan`. Penyelesaian ganda ditolak.
  - Paket Isi Pundi (`lib/pundi-paket.ts`): Eceran 10rb, Pemula 25,5rb, Pedagang 52rb, Saudagar 106rb, Juragan 270rb.
    Bonus dicatat sebagai transaksi `bonus`.
  - UI pilih paket ada di Pakhuis (`IsiPundiPaket`, menggantikan `IsiPundiButton`).
- **SQL:** migrasi `20261005131206_wallet_holds` (tabel + CHECK `amount>0`, kind, status).
  Sudah di-apply ke `kongsi_dev`. **Produksi: belum**, menunggu persetujuan Tara.
- **Verifikasi:**
  - `npx tsc --noEmit` lolos.
  - `npx tsx --conditions=react-server scripts/uji/pundi.ts` lulus 10/10, termasuk balapan 5 hold bersamaan
    (3 lolos, saldo tak negatif) dan Σ transaksi = saldo.
  - Uji browser: paket Pemula → ledger +25.000 dan bonus +500.
- **Rollback:** `git revert kd-tukar-m1`. Tabel `wallet_holds` boleh dibiarkan; untuk benar-benar menghapus,
  buat migrasi baru `DROP TABLE "wallet_holds"`.

### Ch 8.13 — Tukar Guling v2, M2: Mesin Taksiran
2026-10-05
- **Tujuan:** nilai barang barter ditaksir sistem, bukan diketik bebas oleh user.
- **Rumus** (`lib/domain/taksiran.ts`, fungsi murni, dipakai server dan pratinjau client):
  - Komoditas: jumlah × harga per satuan terbaru × faktor kondisi, rentang ±5%.
  - Aset: penyusutan saldo menurun (`rate_y1` tahun pertama, `rate_next` per tahun berikutnya, tidak di bawah
    `floor_pct`) × faktor kondisi, rentang ±10%. Barang umur 0 tahun kena setengah susut tahun pertama.
  - Faktor kondisi = 1 − jumlah penalti checklist yang dijawab "Ya", minimal 0,3.
  - Hasil dibulatkan ke 500 (di bawah 50rb) atau 1.000.
- **Skema:**
  - `BarterCategory` (`barter_categories`): 10 kategori awal. Komoditas: beras, gula, minyak goreng.
    Aset: sepeda, ponsel, laptop, elektronik rumah, buku, pakaian & sepatu, lainnya.
  - `CommodityPrice` (`commodity_prices`): riwayat harga; harga terbaru yang dipakai.
  - Kolom baru `barter_items`: `category, qty, purchase_price, purchase_year, checklist, serial_number,
    est_low, est_high, ship_weight_kg`. Semua nullable, jadi barang lama tetap tampil.
- **Perubahan:**
  - `tawarkanBarang` menaksir di server. `est_value` dari client diabaikan.
  - Nomor seri (IMEI / nomor rangka / SN) wajib untuk sepeda, ponsel, laptop, dan elektronik rumah, dan
    ditolak bila sama dengan barang lain yang masih aktif.
  - Berat kirim dikunci dari kategori.
  - `TawarkanForm` ditulis ulang jadi 4 langkah: Kategori → Data barang → Kondisi → Foto & tukar.
    - Checklist Ya/Tidak wajib dijawab semua.
    - Kartu "Taksiran Kongsi" tampil live beserta rinciannya.
    - Foto memakai `capture="environment"`.
  - Kartu `/tukar` menampilkan rentang taksiran dan nama kategori.
  - Kantor Kongsi → Sengketa Tukar: tabel **Harga Komoditas** untuk memperbarui harga per satuan
    (aksi `aturHargaKomoditas`, khusus admin).
- **Belum:** harga pasar (scraper/feed) menunggu konfirmasi sumber (Bagian 7). Angka susut dan penalti
  adalah usulan awal agen; Tara bisa mengoreksinya.
- **SQL:** migrasi `20261005135153_taksiran` (tabel, FK, CHECK, plus data awal kategori dan harga komoditas).
  Sudah di-apply ke `kongsi_dev`. **Produksi: belum.**
- **Verifikasi:**
  - `npx tsx scripts/uji/taksiran.ts` lulus 16/16: beras 100kg × 15rb = 1,5jt; sepeda 3,5jt umur 3 tahun = 2.023.000.
  - `tsc` dan `eslint` lolos.
  - Uji browser (mobile + desktop): sepeda 3,5jt/2023 dengan ban perlu ganti tersimpan
    `est_value` 1.922.000 (rentang 1.730.000–2.114.000), berat 15kg.
  - Checklist kosong ditolak. Admin berhasil mengubah harga beras (data uji sudah dihapus).
- **Rollback:** `git revert kd-tukar-m2`. Kolom dan tabel baru boleh dibiarkan (nullable); untuk menghapus,
  buat migrasi baru.

### Ch 8.14 — Tukar Guling v2, M3: kesepakatan, bea, rekber, COD QR
2026-10-05
- **Alur** (`lib/domain/tukar.ts`, semua dalam transaksi dengan baris deal dikunci `FOR UPDATE`):
  1. **Ajukan:** A memilih barangnya.
     - Kalkulator menampilkan nilai kedua barang, selisih, dan bea.
     - Bea A (10% taksiran, maks 10rb) langsung **ditahan**, plus tambahan Keteng bila barang A lebih rendah.
     - Aturan tambah: A lebih rendah → minimal selisih. A lebih tinggi → B diminta 0 sampai selisih (A boleh merelakan).
  2. **Terima** (hanya B):
     - B memilih Titik Aman (jenis tempat umum + nama tempat, bukan alamat rumah).
     - Bea B (+ tambahan bila B yang menambah) ditahan.
     - Kedua barang jadi `dalam_tukar`. Tawaran lain untuk barang yang sama otomatis ditolak dan rekbernya dikembalikan.
     - Kontak (email) lawan baru dibuka setelah sepakat.
  3. **Ketemuan:** tiap pihak menunjukkan QR + kode 6 digit dan memindai/mengetik kode lawan.
     - Kode diturunkan HMAC (`BARTER_QR_SECRET`, cadangan `BETTER_AUTH_SECRET`), jadi tidak disimpan di DB.
     - Maksimal 10 kode salah. Hitungan salah tetap tersimpan walau aksinya gagal.
     - Kedua kode cocok → **selesai**: bea diambil platform, tambahan Keteng dilepas ke lawan, barang jadi `ditukar`.
  4. **Batal di tempat:** semua rekber kembali, termasuk bea, dan barang aktif lagi.
     **Sengketa:** rekber tetap ditahan. Syahbandar memutus "selesai" (rekber dilepas) atau "batal" (rekber kembali).
  5. **Kedaluwarsa** (cron `POST /api/cron/advance-barter`, header `Bearer CRON_SECRET`):
     - Tawaran tak dijawab 7 hari kedaluwarsa.
     - Sepakat tapi tidak ketemuan dalam 72 jam juga kedaluwarsa.
     - Semua rekber kembali.
- **Aturan murni** (`lib/domain/tukar-aturan.ts`, dipakai server & client): `beaTukar`, `hitungSelisih`,
  `validasiTambah`, `TITIK_AMAN`, state machine `pastikanBoleh` (siapa boleh apa di status apa), label status.
- **Status deal disatukan:** `proposed | agreed | done | rejected | cancelled | expired | disputed | resolved`.
  Status lama `ditolak`/`dibatalkan` dimigrasi dan dijaga CHECK. Status barang `dalam_tukar` ditambahkan.
- **UI:**
  - Kalkulator di lembar bawah (portal ke `body`, karena `<main>` punya `z-[2]` yang membuatnya kalah dari BottomNav).
  - Halaman baru `/tukar/deal/[id]`: neraca tukar, terima + Titik Aman, QR (SVG dari paket `qrcode`, dirender di server),
    pindai kamera (`BarcodeDetector`) atau ketik kode, hitung mundur, batal/sengketa, penilaian bintang.
  - Daftar tawaran di `/tukar` menaut ke halaman deal. Penilaian hanya dibuka untuk `done`/`resolved`.
  - `ubahStatusTukar` (bebas lompat status) **dihapus**.
- **Dependensi baru:** `qrcode`, `@types/qrcode`. `npm audit` melaporkan 17 kerentanan, termasuk 1 kritis di `next`;
  semuanya sudah ada sebelum perubahan ini, tidak berasal dari `qrcode`.
- **SQL:** migrasi `20261005140117_tukar_deal` (kolom deal, pemetaan status lama, CHECK status/mode/topup, status barang).
  Sudah di-apply ke `kongsi_dev`. **Produksi: belum.**
- **Deploy nanti:** tambah baris crontab VPS (mis. tiap 10 menit) untuk `/api/cron/advance-barter`.
  Isi `BARTER_QR_SECRET` di `.env` VPS.
- **Verifikasi:**
  - `scripts/uji/tukar.ts` lulus 32/32: bea, transisi ilegal, saldo kurang, ajuan ganda, auto-tolak tawaran lain,
    kode salah, orang luar, selesai, batal, kedaluwarsa, sengketa, dan Σ transaksi = saldo.
  - Uji browser dua akun (mobile): ajukan beras 1,5jt ⇄ sepeda 1,9jt + 400rb → terima di Indomaret → kode salah
    ditolak → saling ketik kode → selesai → bintang 5. Saldo DB tepat: penguji −410.000, admin −10.000 +400.000.
  - `npm run flow` 19/19 (`scripts/flow.mjs` disesuaikan dengan label Keteng dan form 4 langkah).
  - Cron tanpa kunci 401. Tamu tetap bisa melihat `/tukar`; halaman deal mengarahkan tamu ke `/masuk`.
- **Rollback:** `git revert kd-tukar-m3`. Kolom baru boleh dibiarkan. Bila revert, status deal `rejected`/`cancelled`
  tetap ada di DB (kode lama hanya menampilkannya apa adanya).

### Ch 8.15 — Tukar Guling v2, M4: mode Kirim via KiriminAja
2026-10-06
- **Keputusan Tara:** kurir memakai **KiriminAja** (Mitra API), bukan Biteship.
  Dokumentasi: github.com/kiriminaja/docs. SDK PHP hanya dipakai sebagai rujukan endpoint.
- **Klien** `lib/shipping/kiriminaja.ts`:
  - Endpoint yang dipakai:
    - `GET /api/mitra/v6.1/addresses` (cari kelurahan)
    - `POST /v6.1/shipping_price` (tarif + asuransi)
    - `POST /v2/schedules` (jadwal pickup)
    - `POST /v6.2/pin/validate` lalu `POST /v6.2/request_pickup` (ongkir dipotong dari **KA Credit** platform)
    - `POST /v3/cancel_shipment`
  - Env: `KIRIMINAJA_API_KEY`, `KIRIMINAJA_BASE_URL` (default sandbox `tdev`), `KIRIMINAJA_PIN`.
  - Tanpa key dengan `KIRIMINAJA_MOCK=true` → **driver tiruan**. Tanpa keduanya, mode Kirim tersembunyi dan
    hanya COD yang tampil.
- **Alur** (`lib/domain/tukar-kirim.ts`):
  1. Pengaju memilih "Kirim kurir" + alamat. Ditahan: bea + tambahan + **deposit** (10%, min 5rb, maks 200rb).
  2. Penerima memilih alamat.
     - Tarif termurah dua arah dihitung (ongkir + asuransi). Berat & dimensi dikunci dari kategori, misalnya
       sepeda 140×20×75 cm; komoditas dihitung sebagai kubus setara berat.
     - Dua paket berstatus `quoted` dibuat.
     - Penerima langsung menahan bea + deposit + **ongkir barang yang ia terima** ("bayar apa yang kamu terima").
  3. Pengaju melunasi ongkirnya dalam **12 jam**. Bila tidak, kedaluwarsa, penyebab = pengaju, dan semua rekber kembali.
  4. Dua-duanya lunas → dua order dibuat di KiriminAja.
     - Paket diklaim atomik (`paid|failed → requested`), jadi tidak ada order dobel.
     - Rekber ongkir **diambil** (dibayar dari KA Credit).
     - Gagal → status `failed` + tombol "Coba buat order kurir lagi". Deal → `dikirim`.
  5. **Webhook** `POST /api/kiriminaja/webhook` (header `Bearer {api_key}`, dicek timing-safe).
     - Event yang diproses: `processed/shipped/finished/canceled/returned/problem_packages`.
       Status tidak mundur karena callback terlambat.
     - Dua paket sampai → `diterima` → tiap pihak konfirmasi (atau **otomatis 48 jam** lewat cron) → selesai:
       bea diambil, tambahan dilepas, deposit kembali.
     - Paket batal/diretur/bermasalah → otomatis ke Syahbandar beserta alasan dari kurir.
  6. **Penahanan silang** (cron): satu paket sudah jalan > 48 jam, paket lain belum diserahkan → Syahbandar,
     `fault_party` = pihak yang belum kirim. Deposit tetap ditahan menunggu putusan.
- **Lainnya:**
  - Batal sepihak hanya boleh sebelum order kurir dibuat.
  - Cron `advance-barter` kini menjalankan `majukanTukar()`: kedaluwarsa, konfirmasi otomatis, dan penahanan silang.
- **Alamat** (`UserAddress`, `/pakhuis/alamat`):
  - Isi: nama, HP (divalidasi sesuai aturan KiriminAja), jalan, kelurahan dari pencarian wilayah (ID KiriminAja + kode pos),
    dan titik koordinat ("Pakai lokasiku", wajib untuk pickup).
  - Maksimal 5 alamat per user.
  - Pencarian wilayah di-cache 24 jam dan dibatasi 20 kali/menit per user.
- **UI:**
  - Lembar Ajukan Tukar: pilihan 🤝 COD / 📦 Kirim, pilih alamat, baris deposit.
  - Halaman deal: kartu paket per arah (kurir, estimasi, ongkir, resi, status), bayar ongkir + hitung mundur,
    coba ulang order, konfirmasi terima.
  - Admin Syahbandar menampilkan mode, alasan, dan penyebab dari sistem.
- **Skema:** migrasi `20261005170606_tukar_kirim`.
  - `user_addresses`, `barter_shipments` (unik `order_id` dan `(deal_id, leg)`).
  - Kolom deal: `address_a/b_id, deposit_a/b, confirmed_a/b_at`.
  - Status deal + `dikirim|diterima`.
  - Dimensi paket di `barter_categories`.
  - Sudah di-apply ke `kongsi_dev`. **Produksi: belum.**
- **Catatan teknis:**
  - `ajukan` tidak lagi menjalankan query paralel di dalam transaksi.
  - Peringatan `pg` "client.query() when already executing" yang tersisa berasal dari internal Prisma adapter-pg,
    bukan kode kita.
  - Kurir instan (GoSend/Grab, maks 40 kg, butuh koordinat) **belum** dipakai. Barang berat memakai layanan
    express/trucking dari hasil tarif.
- **Verifikasi:**
  - `scripts/uji/kirim.ts` lulus 30/30 (driver tiruan): deposit, dimensi, validasi alamat/HP, rekber per pihak,
    order tidak dobel, webhook idempoten, konfirmasi, kedaluwarsa ongkir, penahanan silang, paket bermasalah,
    dan Σ transaksi = saldo.
  - Uji ulang: `pundi` 10/10, `taksiran` 16/16, `tukar` 32/32, `npm run flow` 19/19.
    Flow kini mengisi Pundi dulu agar tidak bergantung pada sisa saldo penguji.
  - Uji browser dua akun (mobile, dev dengan `KIRIMINAJA_MOCK=true`):
    - Penguji menambah alamat lewat form (cari "sleman", lokasi tiruan).
    - Penguji mengajukan Buku 200rb ⇄ HP 300rb (ditahan 130rb). Admin menerima, penguji membayar ongkir → `dikirim`.
    - Webhook disimulasikan via HTTP (token salah → 401) → sampai → kedua pihak konfirmasi → selesai.
    - DB: bea diambil, deposit 20rb/30rb kembali, dua ongkir diambil, tambahan 100rb dilepas.
- **Untuk produksi:**
  1. Daftar & dapatkan API key: sandbox dulu, lalu produksi.
  2. Isi `KIRIMINAJA_*` di `.env` VPS.
  3. Isi saldo KA Credit dan atur PIN.
  4. `POST /api/mitra/set_callback` ke `https://kongsidagang.store/api/kiriminaja/webhook`.
  5. Tambah baris crontab `advance-barter`.
- **Rollback:** `git revert kd-tukar-m4`. Tabel/kolom baru boleh dibiarkan. Kosongkan `KIRIMINAJA_*` untuk
  mematikan mode Kirim tanpa revert.

### Ch 8.16 — Isi Pundi lewat DOKU Checkout (produksi)
2026-10-06
- **Keputusan Tara:** semua integrasi langsung ke **produksi** (tanpa sandbox).
  - DOKU: `https://api.doku.com`.
  - KiriminAja: `https://client.kiriminaja.com`. Nilai bawaan di kode ikut diganti.
- **Kredensial:** `DOKU_CLIENT_ID` + `DOKU_SECRET_KEY` (`SK-…`) ada di `.env.local`/`.env` VPS, tidak di-commit.
  - Kunci `doku_key_…` (label "API Key") **bukan** Secret Key Checkout; kunci itu ditolak `Invalid Header Signature`.
  - Uji produksi dengan Secret Key benar membuat sesi Rp10.000 (tidak dibayar). Hasilnya HTTP 200 dan link
    `checkout.doku.com`.
  - Metode aktif di akun saat ini: Indomaret, Akulaku, DOKU e-money. QRIS/VA belum aktif dan perlu diaktifkan
    di Back Office.
- **Alur** (`lib/payment/doku.ts`, `lib/domain/pundi.ts`):
  1. `mulaiIsiPundi` membuat `topup_orders` (pending) + sesi `POST /checkout/v1/payment`, berlaku 60 menit,
     dengan maks 3 pending per jam per user. User diarahkan ke halaman DOKU.
  2. DOKU memanggil `POST /api/doku/notifikasi`.
     - Signature non-SNAP (HMAC-SHA256 atas Client-Id, Request-Id, Request-Timestamp, Request-Target, Digest
       body mentah) diverifikasi timing-safe, termasuk pengecekan Client-Id.
     - SUCCESS + nominal sama dengan harga paket → `lunasiIsiPundi`: pending→paid atomik, kredit `isi` + `bonus`.
       Notifikasi ganda tidak mengkredit ulang.
     - FAILED/EXPIRED → pesanan ditandai gagal.
  3. User kembali ke `/pakhuis?isi=<invoice>`. Server memanggil `GET /orders/v1/status/{invoice}` bila
     notifikasi belum datang, lalu menampilkan banner status.
- **Mode lain:**
  - `DOKU_MOCK=true` membuka halaman bayar simulasi `/pakhuis/isi/tiruan` (dev/uji saja; 404 di luar mode tiruan).
  - Tanpa DOKU, tombol demo lama (`ENABLE_TOPUP_DEMO`) tetap dipakai.
- **Skema:** migrasi `20261006090000_topup_doku` (tabel `topup_orders`, unik `invoice_number`, CHECK status &
  nominal).
  - Ditulis manual saat tunnel mati, lalu diverifikasi `prisma migrate dev`: tanpa selisih skema.
  - Sudah di-apply ke `kongsi_dev`.
- **Back Office:**
  - URL notifikasi Checkout = `https://kongsidagang.store/api/doku/notifikasi`.
  - "Token URL" di Pengaturan SNAP **tidak** dipakai Checkout; sebaiknya dikosongkan.
- **Verifikasi:**
  - `scripts/uji/doku.ts` 8/8. Tanda tangan dicocokkan dengan pembanding Python independen; body/Client-Id/secret/
    target palsu ditolak.
  - `scripts/uji/isi-pundi.ts` 15/15: notifikasi palsu 401, nominal salah tidak dikredit, notifikasi ganda dan
    5 pelunasan bersamaan tetap kredit sekali, FAILED, batas pending, Σ transaksi = saldo.
  - Uji lama: pundi 10/10, taksiran 16/16, tukar 32/32, kirim 30/30.
    Satu kali `tukar` sempat berhenti di cek ke-3 (diduga koneksi tunnel baru); diulang dua kali → 32/32.
  - `npm run flow` 20/20, dua kali berturut-turut.
    - Flow kini memakai DOKU tiruan untuk Isi Pundi.
    - Langkah bayar menunggu kondisi, tidak lagi jeda tetap; sebelumnya kadang gagal saat dev server mengompilasi.
- **Rollback:** `git revert kd-isi-doku`. Kosongkan `DOKU_*` di `.env` VPS untuk kembali ke mode demo/mati.
  Tabel `topup_orders` boleh dibiarkan.

### Ch 8.17 — Deploy produksi: Tukar Guling v2 (M1–M4) + Isi Pundi DOKU
2026-10-06
- **Atas permintaan Tara** ("pastikan update terbaru publish"). Produksi sebelumnya masih di `df7fb2d` (Ch 8.11),
  jadi semua pekerjaan M1–M4 + DOKU belum tayang.
- **Langkah:**
  1. Backup DB produksi: `/root/backup-kongsi/kongsi-20261006-015631-pre-tukar-v2.sql.gz` (23 tabel).
  2. `.env` VPS dibackup (`.env.bak-*`), lalu ditambah `DOKU_BASE_URL`, `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY`,
     `BARTER_QR_SECRET` (acak). **Tidak** ada `*_MOCK` di produksi. KiriminAja belum diisi, jadi mode Kirim
     tersembunyi dan hanya COD yang tampil.
  3. `git push origin main --tags`, lalu `bash scripts/deploy.sh` di VPS: migrasi `wallet_holds`, `taksiran`,
     `tukar_deal`, `tukar_kirim`, `topup_doku` diterapkan ke DB `kongsi`; build; pm2 reload. Hasil:
     "Database schema is up to date!", HTTP 200.
  4. `/root/kongsi-cron.sh` (dibackup `.bak-*`) kini juga memanggil `/api/cron/advance-barter` tiap 10 menit.
     Uji manual hasilnya `{"kedaluwarsa":0,"selesai":0,"sengketa":0}`; tanpa kunci → 401.
  5. Data lama di DB produksi: teks "tambahan keping" → "tambahan Keteng" (1 barang, 1 artikel).
- **Verifikasi publik** (https://kongsidagang.store):
  - `/tukar` menampilkan teks baru.
  - `/tukar/tawarkan` untuk tamu → `/masuk`.
  - `/api/doku/notifikasi` tanpa tanda tangan → 401; `/api/kiriminaja/webhook` tanpa token → 401.
  - `/pakhuis/isi/tiruan` → 404.
  - `npm run flow` mode tamu: 10/10 setelah cek harga rahasia diperhalus.
    - Sebelumnya FAIL palsu: lelang produksi sedang berstatus `bayar`, sehingga `revealed_price` 470.000 tampil
      **sesuai desain** (`REVEAL_STATUSES`).
    - Cek kini memastikan `deal_price` (400.000) tidak pernah tampil.
- **Belum:**
  - Uji Isi Pundi sungguhan di produksi (bayar nominal kecil) menunggu Tara; yang sudah dibuktikan baru
    pembuatan sesi.
  - Aktifkan QRIS/VA di DOKU Back Office.
  - KiriminAja (API key, KA Credit, PIN, `set_callback`).
- **Rollback:**
  - Kode: `git revert kd-isi-doku..HEAD` atau tag sebelumnya, lalu jalankan ulang `deploy.sh`.
  - DB: restore backup di atas (`zcat … | docker exec -i kongsi-db psql -U kongsi -d kongsi`) bila migrasi perlu
    dibatalkan total. Hati-hati: data sejak deploy akan hilang.
