# Rencana: Tukar Guling v2 — Keteng, Taksiran, COD QR, Kirim + Rekber

## Context
Tara sudah mematangkan konsep barter Kongsi Dagang (diskusi yang ditempel): bea per transaksi dibayar
pakai **Keteng** (1 Keteng = Rp1, hasil Isi Pundi, tidak bisa diuangkan), nilai barang **ditaksir sistem**
(bukan angka bebas user), selisih nilai ditutup dengan tambah Keteng, dan pertukaran bisa **COD**
(QR handshake) atau **dikirim kurir** dengan rekber, penahanan silang, sengketa ke Syahbandar.

Kondisi kode sekarang (`app/actions/tukar.ts`, `prisma/schema.prisma` L262–311):
- `est_value` diisi bebas oleh user. `topup_keping` hanya dicatat, Keteng tidak benar-benar pindah.
- Tidak ada penjaga state machine: pihak mana pun bisa mengubah status apa saja ke status apa saja.
  Status yang dipakai juga tidak konsisten (`ditolak` vs `rejected`, `dibatalkan`).
- Tidak ada `proposer_id`. Item tidak pernah diberi status `ditukar`.
- Pundi hanya punya `topupDemo` dan `checkoutKeping` di `lib/domain/pundi.ts`. Belum ada helper
  debit/kredit/tahan yang dipakai bersama.

Keputusan Tara:
- **Lingkup:** semua bagian dibangun (bea, paket Isi Pundi, taksiran, COD QR, kirim+rekber, deposit, KYC).
- **Bea:** ditanggung kedua pihak.
- **Kurir:** ~~Biteship~~ → **KiriminAja** (keputusan Tara, 6 Okt 2026; lihat Ch 8.15).
- **DOKU:** belum siap, Isi Pundi tetap demo.
- **Istilah UI:** "Keteng" di semua tempat.

Ini mengubah AGENTS.md §6.1 ("JANGAN escrow dulu") dan Kamus. Keduanya diperbarui di M1.

### Rekomendasi atas pertanyaan "deposit & KYC perlu gak?"
- **Deposit: perlu, tapi hanya untuk mode Kirim.**
  - Di COD barang dicek di tempat dan bisa dibatalkan di tempat, jadi deposit tidak perlu.
  - Di mode Kirim dengan nilai 1:1 (tanpa tambah Keteng), tidak ada uang di rekber untuk ganti rugi.
    Deposit menutup celah itu: ongkos retur dan kompensasi dibayar dari deposit pihak yang curang.
  - Usulan: **10% dari taksiran, min 5rb, maks 200rb**. Dikembalikan utuh saat deal selesai.
- **KYC: ringan dan bertingkat.**
  - Selfie + KTP hanya wajib untuk **mode Kirim atau barang > Rp1jt**, disetujui manual oleh admin.
  - Tujuannya mencegah penadahan barang curian dan memungkinkan blacklist NIK.
  - NIK disimpan sebagai hash. Foto disimpan di folder privat, tidak publik (UU PDP).
  - COD barang murah tidak perlu KYC, jadi tetap sesuai prinsip "gedung tua tanpa identitas".

Kalau Tara tidak setuju, deposit atau KYC bisa dimatikan lewat konstanta tanpa membongkar alur.

---

## Milestone (tiap milestone = checkpoint ke Tara + tag `kd-tukar-mN`)

### M1 — Keteng, ledger Pundi, paket Isi Pundi
- **Rename UI Keping → Keteng** di semua komponen/halaman (grep `Keping`). Nama kode `balance` tetap.
  Update Kamus di AGENTS.md (§1, §6.1 escrow diizinkan).
- **`lib/domain/pundi.ts`:** ekstrak helper transaksional dari pola `checkoutKeping`
  (upsert lalu `SELECT … FOR UPDATE`):
  - `debit(tx, userId, amt, kind, note, ref?)`
  - `credit(tx, …)`
  - `hold(tx, userId, dealId, amt, kind)`
  - `releaseHold`, `captureHold`, `refundHold`

  Refactor `checkoutKeping` dan `topupDemo` agar memakai helper ini.
- **Skema:**
  - Model baru `WalletHold`:
    - Kolom: `id, user_id, deal_id?, amount, kind: bea|tambah|deposit|ongkir, status: ditahan|dilepas|diambil|dikembalikan, timestamps`.
    - Saldo `balance` = saldo yang bisa dipakai. Hold mengurangi balance dan dicatat sebagai tx `tahan`.
  - `WalletTransaction.kind` bertambah: `bonus | tahan | lepas | bea_tukar | terima_tukar`.
- **Paket Isi Pundi:** konstanta `TOPUP_PACKAGES` di pundi.ts. Bonus dicatat sebagai tx `bonus` terpisah.
  Usulan nilai (Tara boleh ubah):

  | Bayar | Keteng | Bonus |
  |---|---|---|
  | 10rb | 10rb | 0 |
  | 25rb | 25,5rb | 2% |
  | 50rb | 52rb | 4% |
  | 100rb | 106rb | 6% |
  | 250rb | 270rb | 8% |

  - `topupDemo` menerima `packageId`. Interface tetap sama supaya DOKU nanti tinggal menggantikannya.
  - UI: kartu paket di `components/kongsi/PundiActions.tsx`, dengan catatan "Keteng tidak dapat diuangkan".

### M2 — Mesin Taksiran (dasar)
- **Model `BarterCategory`:**
  - Kolom: `slug, name, kind: komoditas|aset, unit?, rate_y1, rate_next, floor_pct, ship_weight_kg, ship_dims, needs_serial, checklist Json`.
  - Checklist berisi pertanyaan Ya/Tidak beserta bobot penurun nilai.
  - Seed contoh: beras, gula, minyak (komoditas); sepeda, HP, laptop, buku, fashion (aset).
- **Model `CommodityPrice`:** `category_slug, price_per_unit, source: admin|feed, updated_at`.
  Diisi admin di Kantor Kongsi. Tidak ada scraper (sesuai Bagian 7, perlu konfirmasi Tara dulu).
- **Kolom baru `BarterItem`:**
  - Input user: `category, qty, purchase_price, purchase_year, checklist Json, serial_number?`
  - Hasil sistem: `est_low, est_high`. `est_value` jadi nilai tengah hasil sistem dan tidak bisa diketik user.
  - Dari kategori, dikunci: `ship_weight_kg`.
- **`lib/domain/taksiran.ts`** (fungsi murni, mudah dites):
  - Komoditas: `qty × harga terbaru`, rentang ±5%.
  - Aset: declining balance (`rate_y1`, lalu `rate_next` per tahun, tidak di bawah `floor_pct`) × faktor
    kondisi dari checklist, rentang ±10%.
  - Ada slot `market_median?` per kategori (diisi admin) yang dicampur 50:50 bila tersedia.
- **`TawarkanForm.tsx`:**
  - Ditulis ulang utuh jadi alur bertahap: kategori → atribut → checklist chip Ya/Tidak → foto.
  - Foto pakai `capture="environment"` (kamera langsung).
  - Preview taksiran tampil live lewat server action `hitungTaksiran`.

### M3 — State machine deal, bea, rekber, COD QR
- **Kolom baru `BarterDeal`:**
  - Pihak & mode: `proposer_id, mode: cod|kirim`.
  - Snapshot nilai: `value_a, value_b`.
  - Tambah Keteng: `topup_from: a|b|null` (`topup_keping` yang lama tetap dipakai).
  - Bea & waktu: `fee_a, fee_b, agreed_at, expires_at`.
  - COD: `meet_point?, code_a_hash, code_b_hash, scanned_a_at, scanned_b_at`.
  - Penutupan: `cancel_reason, fault_party?`.
- **Status dikunci di `lib/domain/tukar.ts`** (file baru; logika dipindah dari actions):
  - Alur utama: `proposed → agreed → (cod: bertemu) | (kirim: dikirim → diterima) → done`.
  - Cabang: `rejected`, `cancelled`, `expired`, `disputed → resolved`.
  - Fungsi `transition(deal, actor, event)` memvalidasi siapa boleh melakukan apa. Contoh: hanya
    penerima boleh menerima tawaran, dan `done` hanya tercapai lewat handshake atau konfirmasi.
- **Bea:** `beaTukar(v) = min(10_000, ceil(v × 10%))` dihitung per pihak dari taksiran barangnya sendiri.
  - Saat **agree**, satu transaksi DB menahan untuk tiap pihak: bea + tambah Keteng (dari pihak yang
    nilainya lebih rendah) + deposit (hanya mode kirim) + ongkir (M4).
  - Bila saldo kurang, muncul CTA Isi Pundi.
  - Saat `done`: bea diambil, tambah Keteng dilepas ke penerima, deposit dikembalikan, item jadi `ditukar`.
  - Batal tanpa ada yang salah: semua dikembalikan, termasuk bea (tetap berupa Keteng). Pihak yang
    salah kehilangan bea dan depositnya.
- **Kalkulator barter di `AjukanTukar`:**
  - Menampilkan nilai A, nilai B, selisih, dan siapa yang menambah Keteng.
  - Tambah Keteng minimal sebesar selisih (default = selisih).
  - Menampilkan bea masing-masing pihak.
- **COD QR handshake:**
  - Tiap pihak punya token bertanda tangan (HMAC, env `BARTER_QR_SECRET`) yang ditampilkan sebagai QR
    plus kode 6 digit cadangan (`inputMode="numeric"`).
  - Scan pakai `BarcodeDetector`, dengan fallback lib `html5-qrcode` (cek kompatibilitas dulu).
  - Kedua scan tercatat → `done`.
  - Tombol "Batalkan di tempat" → `cancelled`, semua dikembalikan.
  - Titik temu dipilih dari daftar "Titik Aman" (konstanta/seed: minimarket, kedai, pos polisi). Bukan alamat bebas.
- **SLA:** `expires_at = agreed_at + 12 jam` untuk mulai kirim, atau 72 jam untuk COD.
  - Route baru `app/api/cron/advance-barter` mengikuti pola `app/api/cron/advance-auctions`
    (auth secret yang sama).
  - Cron menandai deal `expired` dan mengembalikan hold.
- **Komponen:** `DealActions` di `components/kongsi/BarterActions.tsx` ditulis ulang utuh per status.
  Halaman deal baru `app/(kongsi)/tukar/deal/[id]/page.tsx` (QR, timeline, pelacakan).

### M4 — Mode Kirim via KiriminAja (semula Biteship)
- **`lib/shipping/biteship.ts`:** `getRates, createOrder, getTracking`. Env `BITESHIP_API_KEY`.
  Tanpa key → driver mock, supaya dev dan tes tetap jalan.
- **Model `BarterShipment`:**
  - Kolom: `deal_id, direction: a_to_b|b_to_a, origin/dest address+coords, courier, service, cost, biteship_order_id, waybill, status, events Json, timestamps`.
  - Alamat diisi saat agree untuk mode kirim (atau diambil dari alamat checkout bila sudah ada modelnya).
- **Aturan pengiriman:**
  - Berat dan dimensi diambil dari kategori, user tidak bisa mengubahnya.
  - Kategori berat (≥ 20kg) → hanya kurir instan mobil, dengan batas radius 50km saat mengajukan.
  - Ongkir dibayar pihak yang menerima barang ("bayar apa yang kamu terima"), ditahan saat agree,
    lalu diambil saat order dibuat.
- **Webhook `app/api/biteship/webhook`:**
  - Wajib memverifikasi secret header.
  - Memperbarui status pengiriman. Bila kedua arah sudah `delivered`, deal → `diterima`.
  - Kedua pihak konfirmasi atau auto-konfirmasi 48 jam → `done`.
- **Penahanan silang (cron):** bila satu pihak sudah kirim dan pihak lain belum menyerahkan ke kurir
  dalam 2×24 jam → deal batal.
  - `fault_party` = pihak yang belum kirim.
  - Retur dibayar dari deposit plus bea pihak tersebut.

### M5 — Sengketa, deposit, KYC, reputasi
- **Ajukan sengketa** (hanya setelah barang diterima atau saat bertemu):
  - Pelapor menandai butir checklist yang tidak sesuai dan mengunggah video unboxing (wajib untuk mode kirim).
  - Model `BarterDispute`: `deal_id, opener_id, reason, checklist_flags, video_url, decision, decided_by, notes`.
- **Syahbandar** (`app/admin/tukar/page.tsx` + `components/admin/DisputeResolve.tsx`, ditulis ulang). Putusan:
  - `selesai`: rilis normal.
  - `batal`: retur silang via Biteship, dibayar dari deposit pihak yang salah.
  - `kompensasi N`: dari rekber tambah Keteng atau deposit ke korban.

  Semua putusan memindahkan Keteng lewat helper M1.
- **KYC:**
  - Model `KycSubmission`: `user_id, ktp_path, selfie_path, nik_hash, status, reviewed_by`.
  - Upload ke direktori privat. Perlu fungsi baru `savePrivateUpload` di `lib/uploads.ts` yang tidak
    disajikan publik; admin melihatnya lewat route yang dicek perannya.
  - Model `NikBlacklist(nik_hash)` dan kolom `Profile.barter_banned`.
  - Gate di `ajukanTukar` dan saat agree: mode kirim atau nilai > 1jt butuh KYC `disetujui`.
  - Antrean review di admin.
- **Reputasi:**
  - Query agregat: rata-rata bintang, jumlah tukar selesai, sengketa kalah. Tampil sebagai badge di kartu barter.
  - Rating hanya bisa diberikan untuk deal `done`/`resolved` (perbaikan bug yang ada sekarang).
- Wajib nomor seri untuk kategori `needs_serial`. Tukar diblokir bila nomor serinya sama dengan item
  lain yang sedang aktif.

### Di luar lingkup (dicatat di Buku Kongsi sebagai roadmap)
Barter segitiga, keranjang/bundling barter, iklan rewarded, scraper harga pasar, titik "Hub", DOKU asli.

---

## File kritis
- `prisma/schema.prisma` + migrasi baru per milestone (`prisma migrate dev` ke `kongsi_dev` saja;
  deploy ke produksi menunggu persetujuan Tara).
- `lib/domain/pundi.ts` (helper ledger), file baru `lib/domain/tukar.ts`, `lib/domain/taksiran.ts`,
  `lib/shipping/biteship.ts`.
- `app/actions/tukar.ts`, `app/actions/pundi.ts`, admin actions (harga komoditas, KYC, sengketa).
- `lib/queries.ts` (`getBarter*`, `getMyBarter`, `getDisputedDeals`, reputasi).
- `components/kongsi/{TawarkanForm,BarterActions,PundiActions}.tsx`, `components/admin/DisputeResolve.tsx`.
- `app/(kongsi)/tukar/**`, `app/admin/tukar/page.tsx`, `app/api/cron/advance-barter`, `app/api/biteship/webhook`.
- `AGENTS.md` (Kamus + §6.1), `docs/buku-kongsi/BAB-08-vps-prisma.md` (Ch 8.12 dst.),
  `LAMPIRAN-rollback.md`, `prisma/seed.ts`.

## Verifikasi (per milestone)
- `npx tsc --noEmit` lolos. Tes unit untuk fungsi murni:
  - `beaTukar`: 20rb → 2.000; 80rb → 8.000; 1,5jt → 10.000.
  - `taksiran`: beras 100kg × 15rb = 1,5jt; sepeda 3,5jt umur 3 tahun ≈ 2jt sebelum faktor kondisi.
  - `transition`: transisi ilegal ditolak.
- Skrip uji di `kongsi_dev`:
  - A dan B isi Pundi lewat paket → ajukan dengan selisih → agree → cek hold, saldo, dan ledger.
  - QR handshake → `done` → cek bea diambil dan tambah Keteng pindah.
  - Batal di tempat → semua kembali.
  - Saldo total ledger konsisten: Σtx = balance (hold tercatat sebagai tx `tahan`).
- Race: dua agree bersamaan tidak bisa membobol saldo (uji paralel).
- Biteship mock: alur kirim lengkap, termasuk webhook palsu dan cron penahanan silang. Bila key sandbox
  tersedia, uji juga dengan key sandbox.
- Gate: tamu tetap bisa melihat `/tukar`. Ajukan butuh login. Mode kirim atau nilai > 1jt butuh KYC.
  Foto KYC tidak bisa diakses lewat URL publik.
- Grep: tidak ada "Keping" tersisa di UI. Tidak ada hex warna liar.
- Screenshot desktop + mobile: form taksiran, kalkulator, halaman deal QR, admin sengketa.
- Tiap milestone: Chapter Buku Kongsi, tag `kd-tukar-mN`, `graphify update .`, lapor ke Tara sebelum lanjut.
