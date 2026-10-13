<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Catatan Next.js 16 penting untuk project ini:
- `middleware.ts` diganti `proxy.ts` (fungsi bernama `proxy`). Saat ini TIDAK dipakai (Better Auth tak perlu refresh sesi di proxy).
- `cookies()` dari `next/headers` bersifat **async** (`await cookies()`).
<!-- END:nextjs-agent-rules -->

# KONGSI DAGANG — Panduan Kerja Agen

**Versi 2.0 (disesuaikan untuk repo standalone) — 4 Juli 2026**
**Status: ACUAN DESAIN + IMPLEMENTASI. Baca sebelum menyentuh kode.**
Referensi visual: `reference/kongsi-dagang-mockup-v2.html`. Bangun sesuai mockup itu.

> Adaptasi standalone: project ini repo tersendiri (`taracorp/kongsidagang`),
> **bukan** monorepo `beautifio`. Maka:
> - Struktur pakai `app/` langsung (App Router, tanpa `apps/web/src`).
> - **Database: Postgres 16 di VPS 31.97.49.146 (container `kongsi-db`, 127.0.0.1:5434) lewat Prisma 7.**
>   Auth: Better Auth (email+sandi & Google). Supabase TIDAK dipakai lagi sejak Oktober 2026
>   (SQL lama diarsip di `docs/arsip-supabase/`; versi Supabase terakhir = tag `kd-pre-vps`).
> - Dev lokal: tunnel `ssh -N -L 5434:127.0.0.1:5434 root@31.97.49.146` → DB `kongsi_dev`.
> - Auction dibangun **fresh** di repo ini (tidak ada "AuctionLive lama"). Tidak ada fitur
>   Tebak Aku / Bisik / Care di sini.
> - Tailwind v4: token via `@theme` di `app/globals.css` (bukan `tailwind.config.ts` v3).

---

## PRINSIP UTAMA — "MASUK GEDUNG TUA TANPA DIMINTA IDENTITAS"

Tamu bebas masuk dan menjelajah **tanpa login**. Keranjang jalan tanpa akun.
**Daftar hanya diminta saat mau menebus (bayar).** Jangan pasang login-wall di depan.

- Jelajah, lihat lelang, isi keranjang, pakai Juru Tunjuk → **tanpa akun**.
- Menebus/bayar, ikut **Vendu** (lelang khusus), simpan Surat Jalan → **butuh akun**.
- **Lelang Reguler** = terbuka; daftar kilat baru muncul saat klik "Ikut Lelang".
- **Vendu** (lelang khusus) = hanya user login yang boleh ikut.
- **Panjar/persekot: TIDAK dipakai** di versi ini. Ikut lelang = langsung ikut.

---

## ATURAN KERJA

1. Skema DB hanya di `prisma/schema.prisma` + migrasi `prisma/migrations/`. Agen boleh `prisma migrate dev`
   ke `kongsi_dev`; `migrate deploy` ke **produksi** (`kongsi`) hanya setelah Tara setuju.
2. Semua tulis data lewat Server Actions (`app/actions/*`) dengan cek sesi/peran/pemilik — pengganti RLS.
   Komponen client TIDAK boleh mengakses DB langsung.
3. Deploy: VPS 31.97.49.146 via `scripts/deploy.sh` (pm2 `kongsidagang`, port 3020, Traefik Coolify).
4. Jangan klaim selesai tanpa bukti (grep, `npx tsc --noEmit`, query, screenshot).
5. File besar: tulis ulang komponen UTUH, jangan string-replace bertumpuk.
6. Credentials (DOKU, dll) dari env — JANGAN hardcode.
7. Ikuti design tokens PERSIS. Jangan improvisasi warna/font.

---

## BAGIAN 1: BAHASA & PENAMAAN (Kamus Kongsi)

Teks UI pakai kolom "Tampil ke user". Nama variabel/route/tabel pakai "Nama kode".

| Tampil ke user | Route / slug | Nama kode |
|---|---|---|
| Balai Lelang (reguler) | `/lelang` | `auction` |
| Vendu (lelang khusus, login) | `/lelang?jenis=vendu` | `auction.type='vendu'` |
| Tukar Guling (barter) | `/tukar` | `barter` |
| Neraca Harga (ikon Dacin) | `/neraca` | `priceCompare` |
| Lapak Saudagar (daftar; dulu "Loji") | `/lapak` (`/loji` dialihkan) | `merchants` |
| Detail Lapak | `/lapak/[slug]` | `merchantDetail` |
| Kelola Lapak (dasbor pemilik + validasi voucher) | `/pakhuis/lapak` | `merchantDashboard` |
| Kabar untukmu (notifikasi lonceng) | `/kabar-saya` | `notifications` |
| Juru Tunjuk (pemandu belanja) | `/juru-tunjuk` | `concierge` |
| Kabar (artikel) | `/kabar`, `/kabar/[slug]` | `articles` |
| Etalase (highlight kurasi) | komponen di `/` | `curatedFeed` |
| Pilihan Untukmu (personal) | komponen di `/` | `personalFeed` |
| Keranjang | `/keranjang` | `cart` |
| Gerbang Tebus (checkout+daftar) | `/bayar` | `checkout` |
| Pakhuis (akun) | `/pakhuis` | `account` |
| Masuk / Daftar | `/masuk` | `auth` |
| Jadi Saudagar | `/saudagar/daftar` | `merchantOnboarding` |
| Kantor Kongsi (admin) | `/admin/kongsi` | `adminConsole` |

**Istilah domain:**

| Tampil | Arti | Nama kode |
|---|---|---|
| Keteng | saldo dompet **khusus Tukar Guling**, **1 Keteng = Rp 1**, tidak dapat diuangkan | `balance` (integer rupiah) |
| Pundi | dompet (tempat Keteng) | `wallet` |
| Isi Pundi | top up | `topup` |
| Cap | stempel loyalti (10 = 1 potongan) — opsional | `stamps` |
| Surat Jalan | voucher / hak tebus (e-voucher berkode 10 karakter, terikat cabang) | `voucher` |
| Tebus / Gadai | redeem voucher / bayar | `redeem` |
| Bea | biaya layanan | `service_fee` |
| Saudagar | penjual / merchant | `merchant` |
| Cap Segel / Bersegel | penjual terverifikasi | `is_sealed` |
| Bertera / Tera | harga tersertifikasi (label neraca) | `is_verified_price` |
| Syahbandar | admin penengah sengketa (Tukar Guling) | `dispute_admin` |
| Obral Kilat | flash sale | `flash_sale` |
| Pekan Raya | event obral akbar | `mega_sale_event` |

**Panjar / Persekot:** dicadangkan versi mendatang. JANGAN implement sekarang.
**Gulden:** DIBUANG. Hanya ada Keteng (dulu ditulis "Keping" — sejak Oktober 2026 UI memakai "Keteng";
nama kode tetap `balance`/`formatKeping`). Jangan bikin mata uang kedua.

---

## BAGIAN 2: DESIGN TOKENS

### 2.1 Warna — palette "Rempah & Samudera"
```
--parchment #F6E7C7 | --parchment-2 #EFD9AF | --parchment-3 #FBEDD2
--grenadine #D0451F (aksi utama) | --grenadine-d #A9370F
--beeswax   #E7A24A (sorotan/segel) | --beeswax-d #C9852F
--sage #A9C6AE | --olive #77804C
--indigo #16495D (header/judul) | --indigo-d #0E3543 (footer/nav bawah)
--ink #3A2417 | --ink-soft #6A5540 | --green-ok #4C7A4E | --red-bad #B23A1E
```

### 2.2 Token Tailwind v4 (`@theme` di `app/globals.css`)
Pakai prefix `kongsi-` supaya kelas jadi `bg-kongsi-grenadine`, `text-kongsi-indigo`, dst.
Font: `Fraunces` (400/600/900 + italic) untuk judul/angka; `Work Sans` (400–700) body
(via `next/font/google` di `app/layout.tsx`). Shadow keras: `shadow-hard` = `5px 5px 0 #3A2417`.

### 2.3 Aturan gaya
- Border `2px solid ink`, radius 3–6px, kartu penting `shadow-hard`, hover geser `translate(2px,2px)`.
- Tombol utama `bg-grenadine text-parchment`. Judul & harga = Fraunces 900.
- Grain kertas overlay (lihat mockup `body::before`).
- Mobile-first: `inputMode="numeric"` untuk angka, countdown besar, hormati `prefers-reduced-motion`.

---

## BAGIAN 3: KERANGKA (App Router, standalone)

```
app/
  layout.tsx        → RootLayout: font + globals
  (kongsi)/
    layout.tsx      → TopBar + BottomNav + grain
    page.tsx        → Beranda
    lelang/page.tsx
    tukar/page.tsx
    neraca/page.tsx
    lapak/page.tsx · lapak/[slug]/page.tsx · pakhuis/lapak/page.tsx · kabar-saya/page.tsx
    juru-tunjuk/page.tsx
    kabar/page.tsx · kabar/[slug]/page.tsx
    keranjang/page.tsx
    bayar/page.tsx
    pakhuis/page.tsx
    masuk/page.tsx
    saudagar/daftar/page.tsx
  admin/kongsi/page.tsx
components/kongsi/   → komponen UI reusable
app/actions/         → Server Actions (tulis data, pengganti RLS)
app/api/             → auth (Better Auth), lelang/stream (SSE), cron/advance-auctions
lib/db.ts            → PrismaClient · lib/auth.ts → Better Auth · lib/queries.ts → baca data
lib/domain/          → logika bisnis (lelang, pundi, saudagar) — port dari plpgsql
prisma/              → schema.prisma, migrations/, seed.ts
```

**Chrome (rangka tetap):**
- **TopBar:** kiri = logo Kongsi Dagang (klik → Beranda); kanan = ikon Keranjang (badge),
  ikon Kabar/notifikasi (badge), tombol **Masuk** (saat login: **Pakhuis-ku** + saldo Keteng). Lonceng → `/kabar-saya`.
- **BottomNav (5 tab):** Beranda · Tukar Guling · Neraca · Lapak · Kabar.
  Lelang TIDAK di bottom nav — menonjol di Beranda. Akun & notifikasi di TopBar.

---

## BAGIAN 4: HALAMAN → ISI & DATA

| Halaman | Isi | Data |
|---|---|---|
| **Beranda** | hero → Lelang berlangsung (fallback slot iklan) → teaser Juru Tunjuk → Etalase (kurasi) → Pilihan Untukmu | `auction`, `curatedFeed`, `personalFeed` |
| **Balai Lelang** | lelang tebak-harga 6–7 fase. Badge reguler/Vendu. | `auction_*` |
| **Tukar Guling** | grid tawaran barter + contoh kesepakatan (tukar + tambah keping) | `barter_items`, `barter_deals` |
| **Neraca** | perbandingan perawatan antar-lapak, lapak bersegel diprioritaskan, badge termurah/bertera | `merchant_products` |
| **Lapak / Detail** | grid lapak + perawatan per kategori (e-voucher, pilih cabang) + obral kilat | `merchants`, `merchant_branches`, `merchant_products` |
| **Juru Tunjuk** | kuis tap-tap 3 langkah → hasil produk | statis + `personalFeed` |
| **Kabar** | daftar artikel (1 besar + grid) | `articles` |
| **Keranjang** | item + ringkasan (subtotal/bea/ongkir) — tanpa login | state client + `cart` |
| **Bayar** | gate daftar dulu → ringkasan tebus → DOKU/Pundi | `auth` + `orders` |
| **Pakhuis** | Pundi (Keping) + Isi Pundi, level, Cap, Surat Jalan, riwayat | `wallet`, `user_level`, `vouchers` |
| **Kantor Kongsi** | stat live, kelola barang lelang (harga rahasia), Saudagar, sengketa, Kabar | semua tabel (role admin) |

---

## BAGIAN 5: LEVEL PELANGGAN (tangga)

Naik berdasar akumulasi transaksi. Nama & urutan **dikunci**:

1. **Pelanggan Kecil** — baru daftar
2. **Pelanggan Besar** — mulai rutin
3. **Tuan Kecil** — pembeli aktif
4. **Tuan Besar** — akses Vendu tanpa antre, potongan bea
5. **Juragan** — pucuk; hak penuh (Vendu prioritas, bea minim, bayar tempo)

Enum `user_level`. Ambang (rupiah akumulasi) ditentukan Tara — tanya dulu sebelum hardcode.
"Saudagar" TIDAK dipakai di tangga ini (itu untuk penjual).

---

## BAGIAN 6: FITUR — SPEK RINGKAS

### 6.1 Tukar Guling (barter) — v3 (disetujui Tara, 13 Okt 2026; Buku Kongsi Ch 8.35)
**Prinsip (arahan keras Tara):** platform tidak pernah rugi/menanggung risiko; risiko jatuh ke pihak yang salah;
tidak ada ganti rugi antar-user (aman dari akun kembar).
- Nilai barang **ditaksir sistem** (Juru Taksir: BigGo + SearXNG `kongsi-searxng` + lapak mitra → `lib/taksir/*`,
  rumus `lib/domain/taksiran.ts`). Label akurasi tampil ke semua pihak; banding lewat **tera Penaksir** (admin).
  Tombol pilihan WAJIB pola `.jt-chip` (kotak), bukan bulat.
- **Ajukan gratis** (tanpa tahanan); maks 3 tawaran menunggu per pengaju; kedaluwarsa 72 jam.
- **Selisih = UANG** (QRIS/VA saja, `METODE_SELISIH`), dibayar pihak bernilai lebih rendah, **maks 50%** nilai barang
  termahal. Ditahan Kongsi (`barter_deals.selisih_status`), diteruskan ke rekening penerima ≤ 2 hari kerja lewat
  `transfer_keluar` (`/admin/transfer`). Pembayar juga membayar biaya transfer pencairan (`BIAYA_TRANSFER` Rp2.500).
- **Keteng hanya jaminan:** bea (10% taksiran sendiri, maks 10rb), **cadangan** penerima selisih (biaya pengembalian
  dana: transfer + biaya DOKU), deposit Kirim (= max(10% nilai, ongkir paket keluar)), ongkir.
- **Terima → `menunggu_bayar`:** penerima menahan jaminannya saat menerima; pengaju menyetor dalam 12 jam
  (`tenggatBayar`: jatuh 22.00–08.00 WIB → 10.00 WIB), pengingat 2 jam sebelum. Bila penerima tawaran yang membayar
  selisih, ia membayar SETELAH pengaju (penerima selisih) menahan cadangan. Tagihan DOKU gabungan: Keteng kurang +
  uang rekber (`topup_orders.rekber`, tujuan `tukar_setor`). Tidak lunas → batal + catatan pelanggaran.
- **Batal:** jaminan kembali kecuali bea pihak penyebab (hangus). Selisih kembali ke rekening pembayar: penerima selisih
  bersalah → utuh (dari cadangannya); selain itu dipotong biaya transfer. COD "barang tidak sesuai" → lawan penyebab
  tanpa bea hangus. Setelah ada pindaian, tidak bisa batal sepihak.
- **Sanksi:** `sanksi_tukar`; 3 dalam 30 hari → tidak bisa ajukan/terima 30 hari.
- **Syahbandar** (`/admin/tukar`): Sah/Batal + pihak bersalah + alasan wajib (tercatat `putus_oleh/putus_alasan`);
  tidak boleh memutus deal sendiri; sengketa wajib foto bukti; > 7 hari → kabar Ketua.
- Mode **COD** (QR handshake, Titik Aman) atau **Kirim** (KiriminAja — `lib/shipping/kiriminaja.ts`; konfirmasi
  otomatis 72 jam + pengingat 24 & 6 jam; ongkir kembali hanya bila kurir memastikan batal, Ch 8.33).
- Rekening user: `rekening_user` (`/pakhuis/rekening`), wajib untuk tukar ber-selisih. Deal lama `versi=2` tidak bisa
  diterima lagi (minta ajukan ulang).
- Belum: barter segitiga, bundling, KYC. Isi Pundi lewat DOKU Checkout (`lib/payment/doku.ts`).

### 6.1b E-voucher lapak (Okt 2026)
- Keranjang menyimpan `productId` + `branchId` (localStorage `kongsi.cart.v2`); harga SELALU dari DB (`lib/domain/belanja.ts`).
- Dibayar **uang** lewat DOKU (bukan Keteng): `Order` "menunggu" + `OrderItem` snapshot → notifikasi lunas
  (`lunasiBelanja`) → 1 voucher per unit, kode unik (tanpa 0/O/1/I/L), berlaku `valid_days`.
- Tagihan = harga voucher (titipan lapak) + **platform fee Rp4.000** (`PLATFORM_FEE`, + PPN 11% bila `KONGSI_PKP=true`)
  + biaya pembayaran DOKU metode pilihan (gross-up incl. PPN, `lib/payment/biaya.ts`) → Kongsi terima bersih.
  Tidak ada bea gratis per level/Cap.
- Ditebus petugas lapak di `/pakhuis/lapak` (cabang harus cocok, atomik); voucher lelang ditebus admin di `/admin`.
- **Setoran lapak (Fase 3, Ch 8.37):** titipan disetor hanya untuk voucher ditebus ≥ 3 hari tanpa laporan atau
  kedaluwarsa (`/admin/setoran` → `transfer_keluar` ke rekening lapak). Laporan pembeli membekukan voucher; laporan
  diterima / cabang tutup → pembeli kembali utuh, biaya (platform fee + DOKU + transfer) jadi `potongan_lapak`.
  Pembeli boleh pindah cabang gratis selama voucher aktif.
- Data tenant asli: `scripts/data/tenant-asli.ts` (idempoten). Jangan buat data contoh/dummy lagi.
- Notifikasi: `beriKabar(tx, …)` di `lib/domain/kabar-user.ts`, dipanggil di dalam transaksi peristiwanya.

### 6.1c Bayar Langsung & Isi Pundi (Okt 2026)
- **Keteng hanya untuk jaminan Tukar Guling** (bukan selisih). Isi Pundi = nominal 1:1 + biaya DOKU metode pilihan;
  tanpa bonus, tanpa platform fee, tanpa kartu kredit/debit (risiko chargeback).
- User tidak wajib Isi Pundi dulu. Saat saldo kurang (terima tukar, setor jaminan), user membayar lewat DOKU;
  uangnya masuk 1:1 sebagai Keteng lalu aksinya dijalankan otomatis (`lib/domain/bayar-langsung.ts`,
  `topup_orders.tujuan/muatan`). Saldo sebagian → user memilih "pakai saldo + bayar kekurangan" atau "bayar penuh".
- Nominal dihitung server (`nominalLangsung`: dibulatkan ke Rp1.000, minimal Rp10.000). Input divalidasi SEBELUM
  tagihan dibuat. Tujuan gagal → Keteng tetap di Pundi + kabar lonceng. Idempoten (`tujuan_status`).
- Komponen UI: `components/kongsi/BayarLangsung.tsx`; halaman hasil `/bayar/selesai?inv=`.

### 6.2 Juru Tunjuk (concierge) — kuis tap-tap
- 3 langkah, jawaban chip (bukan ketik) — enak di HP.
- Alur: kategori → selera/atribut → kisaran harga → hasil produk.
- Pertanyaan kontekstual per kategori. Versi awal: filter produk mitra berdasar tag.

### 6.3 Kabar (artikel)
- CMS sederhana: `articles(slug, title, cover, tag, body, published_at)`.
- 1 artikel unggulan besar + grid. Tag: Tips Belanja, Cerita Saudagar, Rempah, Tukar Guling, Pekan Raya.

---

## BAGIAN 7: NERACA HARGA — SOURCING (WAJIB BACA)

Jangan langsung scraping marketplace besar (anti-bot + ToS → risiko blokir & hukum). Prioritas:
1. **Harga lapak mitra** (`merchant_products`) — aman, real-time. Bersegel = paling atas.
2. **Feed/affiliate resmi** — legal.
3. **Scraping** hanya sumber yang mengizinkan (cek `robots.txt`+ToS), rate-limit sopan, cache berkala.

`price_listings` punya kolom `source_type: merchant|feed|scrape` supaya UI agnostik.
**Konfirmasi ke Tara sumber mana yang dipakai sebelum menulis scraper apa pun.**

---

## BAGIAN 8: FASE KERJA (urut)

- **Fase A — Rangka & tokens:** A1 tokens+font+layout chrome (TopBar/BottomNav/grain);
  A2 komponen dasar (CompassRose, WaxSeal, SegelBadge, Pill, KongsiButton, ProdukCard, PintuCard) + `/kongsi-kit`.
- **Fase B — Beranda (guest):** hero + Lelang berlangsung (varian ada/kosong) + teaser Juru Tunjuk + Etalase + Pilihan Untukmu. Data dummy.
- **Fase C — Katalog & Loji:** SQL merchants/products/applications (+RLS, JANGAN apply); `/loji` & `/loji/[slug]`; `/saudagar/daftar`.
- **Fase D — Keranjang & Checkout:** `/keranjang` (tanpa akun); `/bayar` gate daftar → DOKU/Pundi.
- **Fase E — Lelang, Neraca, Tukar, Juru Tunjuk, Kabar.**
- **Fase F — Pakhuis, Auth, Admin.**
- **Fase G — Polish + full-flow test.**

Checkpoint: lapor ke Tara setelah TIAP fase + tes bersama. Jangan lanjut tanpa persetujuan.

---

## BAGIAN 9: CHECKLIST VERIFIKASI (tiap tugas)

```
[ ] npx tsc --noEmit lolos
[ ] grep komponen/route yang diklaim benar ada
[ ] warna & font persis token (tidak ada hex liar)
[ ] istilah UI pakai Kamus Kongsi (Keping, Pundi, Surat Jalan — bukan Gulden)
[ ] guest bisa jelajah+keranjang TANPA login; daftar hanya di /bayar
[ ] Vendu terkunci untuk non-login
[ ] harga rahasia (deal/set) TIDAK bocor ke client publik
[ ] screenshot desktop + mobile
```

---

## BAGIAN 10: BUKU KONGSI (catatan perubahan & rollback) — WAJIB

Riwayat proyek dicatat di `docs/buku-kongsi/` (Bab → Chapter). Mulai dari `README.md` di sana.
- **Setiap perubahan** → tambah Chapter di Bab aktif (`BAB-07-log-perubahan.md`) dalam commit yang sama.
- **Fase/milestone selesai** → `git tag -a kd-<nama>` + baris baru di `LAMPIRAN-rollback.md`.
- SQL baru → catat nomor migrasi, status apply, dan cara membatalkan.
- Setelah ubah kode → `graphify update .` (peta di `graphify-out/`, tidak di-commit). Pakai
  `graphify query "..."` untuk memahami kode sebelum membaca banyak file (hemat token).
- Rollback default = `git revert <tag>..HEAD`. `reset --hard` hanya atas perintah eksplisit Tara.

---

*Design system & istilah dari diskusi Tara + Claude. Referensi visual: reference/kongsi-dagang-mockup-v2.html.*
