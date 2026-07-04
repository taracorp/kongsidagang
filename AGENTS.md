<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Catatan Next.js 16 penting untuk project ini:
- `middleware.ts` diganti `proxy.ts` (fungsi bernama `proxy`). Sudah dipakai di root untuk refresh sesi Supabase.
- `cookies()` dari `next/headers` bersifat **async** (`await cookies()`).
<!-- END:nextjs-agent-rules -->

# KONGSI DAGANG — Panduan Kerja Agen

**Versi 2.0 (disesuaikan untuk repo standalone) — 4 Juli 2026**
**Status: ACUAN DESAIN + IMPLEMENTASI. Baca sebelum menyentuh kode.**
Referensi visual: `reference/kongsi-dagang-mockup-v2.html`. Bangun sesuai mockup itu.

> Adaptasi standalone: project ini repo tersendiri (`taracorp/kongsidagang`),
> **bukan** monorepo `beautifio`. Maka:
> - Struktur pakai `app/` langsung (App Router, tanpa `apps/web/src`).
> - Supabase project: `dilwxkgmjdrjkruajxli` (lihat `.env.local`). Bukan Supabase beautifio.
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

1. SQL hanya di-apply manual oleh Tara di Supabase SQL Editor. Agen menulis, tidak menjalankan.
2. Edge function deploy hanya Tara.
3. Deploy Vercel: dari root repo ini (`npx vercel --prod`) setelah project di-link.
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
| Loji Saudagar (daftar) | `/loji` | `merchants` |
| Detail Loji | `/loji/[slug]` | `merchantDetail` |
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
| Keping / Keteng | saldo dompet, **1 keping = Rp 1** | `balance` (integer rupiah) |
| Pundi | dompet (tempat keping) | `wallet` |
| Isi Pundi | top up | `topup` |
| Cap | stempel loyalti (10 = 1 potongan) — opsional | `stamps` |
| Surat Jalan | voucher / hak tebus | `voucher` |
| Tebus / Gadai | redeem voucher / bayar | `redeem` |
| Bea | biaya layanan | `service_fee` |
| Saudagar | penjual / merchant | `merchant` |
| Cap Segel / Bersegel | penjual terverifikasi | `is_sealed` |
| Bertera / Tera | harga tersertifikasi (label neraca) | `is_verified_price` |
| Syahbandar | admin penengah sengketa (Tukar Guling) | `dispute_admin` |
| Obral Kilat | flash sale | `flash_sale` |
| Pekan Raya | event obral akbar | `mega_sale_event` |

**Panjar / Persekot:** dicadangkan versi mendatang. JANGAN implement sekarang.
**Gulden:** DIBUANG. Hanya ada Keping. Jangan bikin mata uang kedua.

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
    loji/page.tsx · loji/[slug]/page.tsx
    juru-tunjuk/page.tsx
    kabar/page.tsx · kabar/[slug]/page.tsx
    keranjang/page.tsx
    bayar/page.tsx
    pakhuis/page.tsx
    masuk/page.tsx
    saudagar/daftar/page.tsx
  admin/kongsi/page.tsx
components/kongsi/   → komponen UI reusable
lib/supabase/        → client (browser & server) + helper sesi
proxy.ts             → refresh sesi Supabase
```

**Chrome (rangka tetap):**
- **TopBar:** kiri = logo Kongsi Dagang (klik → Beranda); kanan = ikon Keranjang (badge),
  ikon Kabar/notifikasi (badge), tombol **Masuk Loji**.
- **BottomNav (5 tab):** Beranda · Tukar Guling · Neraca · Loji · Kabar.
  Lelang TIDAK di bottom nav — menonjol di Beranda. Akun & notifikasi di TopBar.

---

## BAGIAN 4: HALAMAN → ISI & DATA

| Halaman | Isi | Data |
|---|---|---|
| **Beranda** | hero → Lelang berlangsung (fallback slot iklan) → teaser Juru Tunjuk → Etalase (kurasi) → Pilihan Untukmu | `auction`, `curatedFeed`, `personalFeed` |
| **Balai Lelang** | lelang tebak-harga 6–7 fase. Badge reguler/Vendu. | `auction_*` |
| **Tukar Guling** | grid tawaran barter + contoh kesepakatan (tukar + tambah keping) | `barter_items`, `barter_deals` |
| **Neraca** | tabel 10 termurah, loji bersegel diprioritaskan, badge termurah/bertera | `price_listings` |
| **Loji / Detail** | grid toko + isi lapak + obral kilat | `merchants`, `merchant_products` |
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

### 6.1 Tukar Guling (barter) — versi sederhana
- User unggah barang + taksiran nilai (keping). Lihat tawaran orang lain.
- Ajukan tukar; boleh **tambah keping** untuk menyeimbangkan nilai.
- **Versi awal: COD/ketemuan + saling beri rating.** JANGAN bikin escrow dulu.
- Sengketa → diadili **Syahbandar** (admin) di Kantor Kongsi.
- Skema minimal: `barter_items(user_id, title, est_value, want_text, photo, status)`,
  `barter_deals(item_a, item_b, topup_keping, status: proposed|agreed|done|disputed)`.

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
1. **Harga loji mitra** (`merchant_products`) — aman, real-time. Bersegel = paling atas.
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

*Design system & istilah dari diskusi Tara + Claude. Referensi visual: reference/kongsi-dagang-mockup-v2.html.*
