// Artikel Kabar Kongsi (Redaksi Kongsi). Isi faktual tentang cara kerja platform & tenant;
// tanpa klaim medis. Dipakai scripts/data/tenant-asli.ts.

export type ArtikelData = {
  slug: string;
  title: string;
  tag: string;
  excerpt: string;
  cover_tone: string;
  body: string[];
};

export const ARTIKEL: ArtikelData[] = [
  {
    slug: "cara-beli-dan-tebus-e-voucher-perawatan",
    title: "Cara membeli dan menebus e-voucher perawatan di Kongsi",
    tag: "Tips Belanja",
    excerpt: "Dari memilih cabang sampai menunjukkan kode Surat Jalan ke petugas — langkah demi langkah.",
    cover_tone: "grenadine",
    body: [
      "Di Kongsi Dagang, perawatan dari lapak mitra dijual dalam bentuk e-voucher. Kamu membayar di aplikasi, lalu datang ke klinik membawa kode Surat Jalan. Tidak perlu membawa uang tunai atau mencetak apa pun.",
      "Langkah pertama: buka Lapak, pilih lapak yang kamu suka, lalu pilih perawatannya. Saat menekan tombol + Keranjang, kamu akan diminta memilih cabang. Pilih dengan teliti, karena e-voucher hanya berlaku di cabang yang kamu pilih saat membeli.",
      "Keranjang boleh diisi tanpa akun. Akun baru diminta ketika kamu mau menebus di Gerbang Tebus. Daftarnya cukup dengan surel dan kata sandi, atau tombol Masuk dengan Google.",
      "Pembayaran memakai Keteng dari Pundi. 1 Keteng sama dengan Rp 1. Kalau saldomu kurang, Gerbang Tebus langsung menunjukkan berapa kekurangannya dan tombol Isi Pundi akan membawa nominal itu ke halaman pembayaran DOKU, jadi kamu cukup mengisi sekali.",
      "Setiap transaksi dikenai bea layanan Rp 2.000. Bea ini gratis untuk pelanggan tingkat Tuan Besar dan Juragan, atau bisa ditukar dengan 10 Cap yang terkumpul dari belanja sebelumnya. Harga perawatan sendiri sama dengan harga menu resmi klinik.",
      "Begitu pembayaran berhasil, satu Surat Jalan terbit untuk setiap voucher yang kamu beli. Kalau kamu membeli dua kali Facial Acne, akan ada dua Surat Jalan dengan kode yang berbeda. Semuanya tersimpan di Pakhuis, bagian Surat Jalan, lengkap dengan kode, QR, alamat cabang, dan tanggal berlaku.",
      "Saat datang ke cabang, tunjukkan QR atau sebutkan kode 10 karakter di Surat Jalan kepada petugas. Petugas memindai atau mengetik kode itu di halaman validasi lapak. Begitu disahkan, status voucher berubah menjadi ditebus dan kamu menerima kabar di lonceng Kongsi.",
      "Satu kode hanya bisa dipakai sekali, dan hanya di cabang yang tertera. Jangan bagikan kode atau foto QR-mu ke orang lain sebelum kamu tiba di klinik. Voucher yang lewat masa berlakunya otomatis berstatus kedaluwarsa.",
    ],
  },
  {
    slug: "membaca-menu-facial-sesuai-kebutuhan-kulit",
    title: "Membaca menu facial: memilih perawatan sesuai kebutuhan kulit",
    tag: "Tips Belanja",
    excerpt: "Acne, Glow, Ageless, Pigment, IPL — apa bedanya, dan kenapa konsultasi tetap penting.",
    cover_tone: "sage",
    body: [
      "Menu klinik kecantikan sering terlihat membingungkan: ada puluhan nama facial dengan harga yang berdekatan. Kabar baiknya, sebagian besar menu dikelompokkan berdasarkan kebutuhan kulit, jadi kamu bisa mulai dari masalah yang paling ingin kamu tangani.",
      "Ambil contoh menu Beauty Center DRW Skincare di Kongsi. Rangkaian Velvet Acne Bloom ditujukan untuk kulit berjerawat. Glimmer Glow untuk kulit yang terasa kusam. Aura Ageless untuk tanda-tanda penuaan. Lumi Pigment Radiant untuk flek dan warna kulit yang tidak merata. Ada juga Hair Treatment untuk rambut dan kulit kepala.",
      "Selain itu ada perawatan berbasis IPL (intense pulsed light) yang namanya biasanya sudah menunjukkan tujuannya, misalnya IPL Hair Removal Wajah dan IPL Kumis untuk bulu halus, IPL Acne, IPL Pigmen, IPL Rejuvenation, dan IPL Vaskular.",
      "Di dalam satu rangkaian, harga yang lebih tinggi biasanya berarti tahapan atau bahan yang berbeda. Jangan menganggap yang termahal pasti yang paling cocok. Untuk percobaan pertama, banyak orang memilih perawatan dasar di rangkaian yang sesuai, lalu menyesuaikan di kunjungan berikutnya.",
      "Kalau masih bingung, pakai Juru Tunjuk di Kongsi. Kamu cukup menjawab tiga pertanyaan: kebutuhan utama, daerah cabang, dan kisaran harga. Juru Tunjuk akan menampilkan perawatan yang sesuai beserta cabangnya.",
      "Yang terpenting: kondisi kulit setiap orang berbeda. Beauty Center menyediakan konsultasi gratis, jadi manfaatkan kesempatan itu untuk menceritakan riwayat kulit, alergi, atau perawatan yang sedang kamu jalani sebelum tindakan dimulai.",
      "Artikel ini adalah panduan memilih menu, bukan saran medis. Untuk masalah kulit yang berat, menetap, atau disertai keluhan lain, konsultasikan dengan dokter.",
    ],
  },
  {
    slug: "mengenal-beauty-center-drw-skincare",
    title: "Mengenal Beauty Center DRW Skincare: 10 cabang, buka setiap hari",
    tag: "Cerita Saudagar",
    excerpt: "Lapak bersegel pertama di Kongsi: facial berkualitas dengan harga bersahabat di Yogyakarta dan sekitarnya.",
    cover_tone: "indigo",
    body: [
      "Beauty Center DRW Skincare adalah lapak bersegel pertama di Kongsi Dagang. Moto yang mereka usung sederhana: Facial Berkualitas, Harga Bersahabat — cantik alami, percaya diri setiap hari.",
      "Beauty Center punya 10 cabang yang tersebar di Yogyakarta dan sekitarnya: Jakal (Jl. Kaliurang Km.14), Parangtritis, Kotagede, Wates di Kulon Progo, Prambanan di Klaten, Tajem, Godean, Rumtik DRW Skincare Rajawali di Condongcatur, Bantul, dan Muntilan di Magelang. Semua cabang buka Senin sampai Minggu pukul 09.00–18.00.",
      "Di situs resminya, Beauty Center menonjolkan terapis profesional, tempat yang higienis dan steril, serta konsultasi gratis sebelum perawatan.",
      "Menu mereka terbagi dalam enam kelompok: Signature Treatment, Velvet Acne Bloom, Glimmer Glow, Aura Ageless, Lumi Pigment Radiant, dan Hair Treatment. Di Kongsi, harga e-voucher sama persis dengan harga menu resmi — mulai Rp 25.000 untuk Wash and Dry sampai Rp 308.000 untuk Pigment Radiant Facial.",
      "Karena satu merek punya banyak cabang, Kongsi meminta kamu memilih cabang saat membeli. E-voucher kemudian hanya bisa ditebus di cabang itu, sehingga petugas di sana sudah siap menerima kedatanganmu.",
      "Beauty Center juga punya program membership di toko (Silver, Gold, dan Platinum) yang dihitung dari transaksi terverifikasi di cabang. Ketentuan membership itu diatur langsung oleh Beauty Center.",
      "Ikuti lapak Beauty Center di Kongsi supaya perawatan mereka muncul di Pilihan Untukmu di Beranda.",
    ],
  },
  {
    slug: "tukar-guling-aman-titik-aman-qr-syahbandar",
    title: "Tukar Guling aman: Titik Aman, kode QR, dan Syahbandar",
    tag: "Tukar Guling",
    excerpt: "Cara Kongsi menjaga barter tetap adil — dari rekber Keteng sampai sengketa.",
    cover_tone: "olive",
    body: [
      "Tukar Guling adalah fitur barter di Kongsi. Kamu menawarkan barangmu, menemukan barang yang kamu incar, lalu bertukar. Bila nilainya timpang, pihak yang barangnya lebih murah menambah Keteng sebagai selisih.",
      "Setiap pihak membayar Bea Tukar sebesar 10% dari taksiran barangnya sendiri, maksimal 10.000 Keteng. Bea dan tambahan Keteng tidak langsung pindah tangan, melainkan ditahan Kongsi (rekber) sampai pertukaran benar-benar terjadi.",
      "Saat menerima tawaran COD, penerima memilih Titik Aman: tempat umum yang terang dan ramai, seperti depan kasir minimarket, kantor polisi, kedai yang ramai, atau stasiun. Jangan pernah bertukar di rumah atau tempat sepi.",
      "Di tempat ketemuan, periksa barang lawan dengan teliti. Kalau sudah puas, tunjukkan kode QR atau enam angka milikmu, dan pindai kode milik lawan. Setelah kedua kode cocok, tukar dinyatakan selesai: bea diambil, tambahan Keteng pindah ke pihak yang berhak, dan barang ditandai sudah ditukar.",
      "Kalau barang ternyata tidak sesuai, tekan Batalkan di tempat. Semua Keteng yang ditahan, termasuk bea, kembali utuh ke masing-masing pihak. Jangan pernah memberikan kodemu sebelum yakin.",
      "Kalau ada masalah yang tidak bisa diselesaikan berdua — misalnya lawan tidak datang atau meminta transfer di luar aplikasi — ajukan ke Syahbandar. Selama sengketa, Keteng tetap ditahan sampai Syahbandar memutuskan.",
      "Kesepakatan COD punya batas 72 jam. Bila tidak ketemuan dalam waktu itu, tawaran kedaluwarsa dan semua Keteng kembali otomatis. Setelah selesai, beri nilai lawan tukarmu supaya komunitas tahu siapa yang bisa dipercaya.",
    ],
  },
  {
    slug: "juru-taksir-cara-kongsi-menaksir-barang",
    title: "Juru Taksir: cara Kongsi menaksir nilai barangmu",
    tag: "Tukar Guling",
    excerpt: "Harga pasar dari berbagai toko, kondisi saat dibeli, dan barang koleksi yang nilainya bisa naik.",
    cover_tone: "beeswax",
    body: [
      "Supaya barter adil, nilai barang di Tukar Guling tidak diketik bebas oleh pemiliknya. Kongsi punya Juru Taksir yang menaksir nilai barang berdasarkan data pasar.",
      "Saat menawarkan barang, tulis nama dan tipenya selengkap mungkin — merek, seri, dan ukuran. Contohnya: TV LED Polytron PLD 32T1850 32 inch. Lalu tekan Cari harga pasar. Juru Taksir membandingkan harga barang yang sama di berbagai toko dan marketplace, memisahkan harga barang baru dan bekas, dan membuang harga yang tidak wajar.",
      "Kamu juga akan ditanya apakah barang itu dibeli baru atau bekas. Ini penting: barang yang dibeli bekas sudah melewati penyusutan terbesarnya, jadi Juru Taksir tidak menyusutkannya dua kali.",
      "Urutan dasarnya begini: kalau ada cukup data harga bekas, itulah patokan utamanya. Kalau hanya ada harga baru, nilainya dihitung dari harga baru sekarang dikurangi penyusutan sesuai umur barang. Kalau tidak ada data pasar sama sekali, Juru Taksir memakai harga beli yang kamu isi.",
      "Barang koleksi, klasik, atau antik diperlakukan berbeda. Centang pilihan koleksi, maka barangmu tidak disusutkan dan nilainya mengikuti harga pasar kolektor — yang bisa saja lebih tinggi dari harga belinya dulu.",
      "Setiap taksiran diberi label akurasi: tinggi, sedang, atau rendah, tergantung banyaknya data pembanding. Kedua pihak bisa melihat daftar pembandingnya, sehingga dasar taksiran terbuka.",
      "Kalau kamu merasa taksirannya kurang tepat, tekan Minta tera Penaksir dan sertakan alasan atau tautan pembanding. Penaksir dari Kantor Kongsi akan menetapkan nilainya, dan barangmu mendapat label Ditera Penaksir.",
    ],
  },
  {
    slug: "pundi-dan-keteng-isi-saldo-dan-kegunaannya",
    title: "Pundi & Keteng: cara isi saldo dan dipakai untuk apa",
    tag: "Tips Belanja",
    excerpt: "Paket hemat berbonus, nominal bebas sampai Rp 50 juta, dan kemana Keteng bisa dibelanjakan.",
    cover_tone: "grenadine",
    body: [
      "Pundi adalah dompet di Kongsi, dan isinya adalah Keteng. 1 Keteng sama dengan Rp 1. Saldo Pundi selalu terlihat di tombol Pakhuis-ku di bagian atas layar, dan rinciannya ada di halaman Pakhuis.",
      "Untuk mengisi Pundi, buka Pakhuis lalu pilih cara isi. Ada Paket Hemat yang memberi bonus Keteng — misalnya Pedagang: bayar Rp 50.000 dapat 52.000 Keteng, atau Juragan: bayar Rp 250.000 dapat 270.000 Keteng.",
      "Untuk kebutuhan besar, pilih Nominal Favorit (500 ribu, 1 juta, 2 juta, 5 juta) atau ketik Nominal Lain mulai Rp 10.000 sampai Rp 50.000.000. Nominal di luar paket tidak mendapat bonus.",
      "Pembayaran dilakukan di halaman aman DOKU. Pilih metode yang tersedia di sana, seperti transfer Virtual Account berbagai bank atau pembayaran di gerai. Begitu pembayaran dikonfirmasi DOKU, Keteng langsung masuk dan kamu mendapat kabar di lonceng.",
      "Keteng dipakai untuk membeli e-voucher di lapak, membayar Bea Tukar dan selisih di Tukar Guling, serta keperluan lain di Kongsi. Kalau saldo kurang saat menebus atau bertukar, Kongsi akan menyarankan nominal yang pas untuk menutup kekurangannya.",
      "Satu hal penting: Keteng tidak dapat diuangkan kembali. Isilah sesuai kebutuhanmu.",
      "Semua mutasi Keteng — isi, bonus, belanja, dan rekber Tukar Guling — tercatat di Riwayat Pundi, sehingga kamu selalu bisa melihat ke mana saja Keteng-mu pergi.",
    ],
  },
];
