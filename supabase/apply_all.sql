
-- ============================================================
-- FILE: supabase/migrations/0001_merchants.sql
-- ============================================================
-- Kongsi Dagang — Fase C: Katalog & Loji
-- APPLY MANUAL oleh Tara di Supabase SQL Editor. Agen TIDAK menjalankan.
-- Prinsip: publik boleh membaca loji & produk tanpa login.

create extension if not exists "pgcrypto";

-- ============================================================
-- Loji / Saudagar (merchant)
-- ============================================================
create table if not exists public.merchants (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  name               text not null,
  category           text not null,
  rating             numeric(2,1) not null default 0,
  tebusan_count      integer not null default 0,          -- jumlah tebusan (transaksi sukses)
  tone               text not null default 'indigo',       -- warna banner (token kongsi)
  cover_from         text,                                  -- gradient cover
  cover_to           text,
  city               text,
  is_sealed          boolean not null default false,        -- Cap Segel / Bersegel
  status             text not null default 'buka',          -- buka | obral | tutup
  flash_sale_ends_at timestamptz,                           -- Obral Kilat berakhir
  owner_id           uuid references auth.users(id) on delete set null,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- Barang di lapak (produk loji)
-- ============================================================
create table if not exists public.merchant_products (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  name         text not null,
  price        integer not null,           -- Keping (1 keping = Rp 1)
  old_price    integer,
  tone         text not null default 'sage',
  tags         text[] not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists merchant_products_merchant_id_idx
  on public.merchant_products (merchant_id);

-- ============================================================
-- Pengajuan Jadi Saudagar (Obral Kilat onboarding)
-- ============================================================
create table if not exists public.merchant_applications (
  id               uuid primary key default gen_random_uuid(),
  loji_name        text not null,
  category         text not null,
  owner_name       text not null,
  whatsapp         text not null,
  join_flash_sale  boolean not null default false,
  status           text not null default 'pending',   -- pending | approved | rejected
  applicant_id     uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.merchants            enable row level security;
alter table public.merchant_products    enable row level security;
alter table public.merchant_applications enable row level security;

-- Publik: baca loji & produk aktif (tanpa login)
create policy "merchants_public_read" on public.merchants
  for select using (is_active = true);

create policy "merchant_products_public_read" on public.merchant_products
  for select using (is_active = true);

-- Pemilik: kelola lojinya sendiri
create policy "merchants_owner_write" on public.merchants
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "merchant_products_owner_write" on public.merchant_products
  for all
  using (exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.merchants m
    where m.id = merchant_id and m.owner_id = auth.uid()
  ));

-- Pengajuan Saudagar: siapa saja boleh mengajukan (tamu / login)
create policy "merchant_applications_insert_any" on public.merchant_applications
  for insert with check (true);

-- Pemohon (bila login) boleh lihat pengajuannya sendiri
create policy "merchant_applications_own_read" on public.merchant_applications
  for select using (auth.uid() = applicant_id);

-- CATATAN: kebijakan admin (Kantor Kongsi) ditambah di Fase F bersama role guard.


-- ============================================================
-- FILE: supabase/migrations/0002_auctions.sql
-- ============================================================
-- Kongsi Dagang — Fase E1: Balai Lelang (auction)
-- APPLY MANUAL oleh Tara. Harga rahasia (deal/set) TIDAK boleh bocor ke publik.

create extension if not exists "pgcrypto";

create table if not exists public.auctions (
  id                uuid primary key default gen_random_uuid(),
  type              text not null default 'reguler',      -- reguler | vendu
  clue_category     text not null,
  clue_name_masked  text not null,                        -- mis. "A•••••••"
  normal_price      integer not null,
  facilities        text[] not null default '{}',
  deal_price        integer,                              -- RAHASIA
  set_price         integer,                              -- RAHASIA (harga yang ditebak)
  status            text not null default 'kumpul',       -- kumpul|tebak|jeda|final|pemenang|bayar|selesai
  capacity          integer not null default 10,
  starts_at         timestamptz,
  winner_id         uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.auction_participants (
  auction_id  uuid not null references public.auctions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (auction_id, user_id)
);

create table if not exists public.auction_guesses (
  id          uuid primary key default gen_random_uuid(),
  auction_id  uuid not null references public.auctions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  round       integer not null default 1,
  guess       integer not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- View publik TANPA kolom rahasia (deal_price, set_price)
-- ============================================================
create or replace view public.auction_items_public
with (security_invoker = false) as
  select id, type, clue_category, clue_name_masked, normal_price,
         facilities, status, capacity, starts_at, winner_id, created_at
  from public.auctions;

-- RLS: base table tidak dibaca anon; hanya lewat view.
alter table public.auctions             enable row level security;
alter table public.auction_participants enable row level security;
alter table public.auction_guesses      enable row level security;

-- Peserta kelola keikutsertaan & tebakannya sendiri
create policy "auction_participants_self" on public.auction_participants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "auction_guesses_self_insert" on public.auction_guesses
  for insert with check (auth.uid() = user_id);
create policy "auction_guesses_self_read" on public.auction_guesses
  for select using (auth.uid() = user_id);

-- Akses view publik
grant select on public.auction_items_public to anon, authenticated;

-- CATATAN: policy admin (kelola auctions + lihat harga rahasia) ditambah di Fase F.


-- ============================================================
-- FILE: supabase/migrations/0003_price_listings.sql
-- ============================================================
-- Kongsi Dagang — Fase E2: Neraca Harga (price_listings)
-- APPLY MANUAL oleh Tara.
-- Sumber awal = merchant_products. JANGAN scraping tanpa izin (lihat AGENTS.md Bagian 7).

create extension if not exists "pgcrypto";

create table if not exists public.price_listings (
  id                 uuid primary key default gen_random_uuid(),
  product_key        text not null,                        -- kunci barang yang dibandingkan
  merchant_id        uuid references public.merchants(id) on delete set null,
  source_type        text not null default 'merchant',     -- merchant | feed | scrape
  loji_name          text not null,
  is_sealed          boolean not null default false,       -- Cap Segel
  rating             numeric(2,1) not null default 0,
  price              integer not null,                     -- Keping (Rp)
  is_verified_price  boolean not null default false,       -- Bertera / Tera
  updated_at         timestamptz not null default now()
);
create index if not exists price_listings_product_key_idx
  on public.price_listings (product_key, price);

alter table public.price_listings enable row level security;

-- Publik boleh baca (perbandingan harga terbuka)
create policy "price_listings_public_read" on public.price_listings
  for select using (true);

-- Tulis hanya via service role / admin (Fase F) — tidak ada policy write untuk anon.


-- ============================================================
-- FILE: supabase/migrations/0004_barter.sql
-- ============================================================
-- Kongsi Dagang — Fase E3: Tukar Guling (barter) — versi sederhana (COD + rating)
-- APPLY MANUAL oleh Tara. JANGAN bikin escrow dulu.

create extension if not exists "pgcrypto";

create table if not exists public.barter_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  est_value   integer not null,          -- taksiran nilai (keping)
  want_text   text,                      -- mau ditukar dengan apa
  city        text,
  tone        text not null default 'sage',
  photo_url   text,
  status      text not null default 'aktif',   -- aktif | ditutup | ditukar
  created_at  timestamptz not null default now()
);
create index if not exists barter_items_status_idx on public.barter_items (status);

create table if not exists public.barter_deals (
  id            uuid primary key default gen_random_uuid(),
  item_a        uuid not null references public.barter_items(id) on delete cascade,
  item_b        uuid not null references public.barter_items(id) on delete cascade,
  topup_keping  integer not null default 0,     -- tambahan keping penyeimbang
  status        text not null default 'proposed', -- proposed | agreed | done | disputed
  created_at    timestamptz not null default now()
);

alter table public.barter_items enable row level security;
alter table public.barter_deals enable row level security;

-- Publik boleh lihat barang barter yang aktif
create policy "barter_items_public_read" on public.barter_items
  for select using (status = 'aktif' or auth.uid() = user_id);

-- Pemilik kelola barangnya
create policy "barter_items_owner_write" on public.barter_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Deal terlihat oleh pihak yang terlibat
create policy "barter_deals_involved_read" on public.barter_deals
  for select using (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  );

-- Mengajukan deal: pihak yang memiliki salah satu item
create policy "barter_deals_propose" on public.barter_deals
  for insert with check (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  );

-- CATATAN: sengketa (disputed) diadili Syahbandar/admin di Fase F.


-- ============================================================
-- FILE: supabase/migrations/0005_articles.sql
-- ============================================================
-- Kongsi Dagang — Fase E5: Kabar (articles) — CMS sederhana
-- APPLY MANUAL oleh Tara.

create extension if not exists "pgcrypto";

create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  tag           text not null,             -- Tips Belanja | Cerita Saudagar | Rempah | Tukar Guling | Pekan Raya
  excerpt       text,
  cover_tone    text not null default 'indigo',
  body          text[] not null default '{}',
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists articles_published_idx on public.articles (published_at desc);

alter table public.articles enable row level security;

-- Publik hanya membaca artikel yang sudah terbit
create policy "articles_public_read" on public.articles
  for select using (published_at is not null and published_at <= now());

-- Tulis hanya admin (Fase F).


-- ============================================================
-- FILE: supabase/migrations/0006_wallet_admin.sql
-- ============================================================
-- Kongsi Dagang — Fase F: Pakhuis (wallet/level/vouchers) + Profiles + policy admin
-- APPLY MANUAL oleh Tara. TANPA Gulden — hanya Keping (1 keping = Rp 1).

create extension if not exists "pgcrypto";

-- Tangga level pelanggan (urutan dikunci)
do $$ begin
  create type public.user_level as enum (
    'pelanggan_kecil', 'pelanggan_besar', 'tuan_kecil', 'tuan_besar', 'juragan'
  );
exception when duplicate_object then null; end $$;

-- Profil + peran
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  level       public.user_level not null default 'pelanggan_kecil',
  stamps      integer not null default 0,          -- Cap loyalti
  is_admin    boolean not null default false,      -- pengurus Kantor Kongsi / Syahbandar
  created_at  timestamptz not null default now()
);

-- Pundi (dompet keping)
create table if not exists public.wallets (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  balance     integer not null default 0,          -- Keping (Rp)
  updated_at  timestamptz not null default now()
);

-- Surat Jalan (voucher / hak tebus)
create table if not exists public.vouchers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  note        text,
  kind        text not null default 'lelang',      -- lelang | neraca | hadiah
  status      text not null default 'aktif',       -- aktif | terpakai | kadaluarsa
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Helper: apakah user sekarang admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.wallets  enable row level security;
alter table public.vouchers enable row level security;

create policy "profiles_self_read"  on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_write" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "wallets_self_read"   on public.wallets  for select using (auth.uid() = user_id);
create policy "vouchers_self_read"  on public.vouchers for select using (auth.uid() = user_id);

-- ============================================================
-- Policy ADMIN untuk tabel fase sebelumnya (Kantor Kongsi)
-- ============================================================
create policy "auctions_admin_all"            on public.auctions             for all using (public.is_admin()) with check (public.is_admin());
create policy "merchant_applications_admin"   on public.merchant_applications for all using (public.is_admin()) with check (public.is_admin());
create policy "price_listings_admin_write"    on public.price_listings       for all using (public.is_admin()) with check (public.is_admin());
create policy "articles_admin_write"          on public.articles             for all using (public.is_admin()) with check (public.is_admin());
create policy "barter_deals_admin"            on public.barter_deals         for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Auto-provision profil + pundi saat user baru daftar
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.wallets (user_id, balance) values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- FILE: supabase/migrations/0007_settings.sql
-- ============================================================
-- Kongsi Dagang — Fase H: Settings (key/value) untuk Sekilas Pariwara & konfigurasi.
-- APPLY MANUAL oleh Tara di Supabase SQL Editor.

create table if not exists public.settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Publik boleh baca (mis. URL iklan tampil di Beranda)
create policy "settings_public_read" on public.settings
  for select using (true);

-- Hanya admin yang boleh menulis
create policy "settings_admin_write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Nilai awal (opsional)
insert into public.settings (key, value) values
  ('ad_video_url', ''),
  ('ad_image_url', '')
on conflict (key) do nothing;


-- ============================================================
-- FILE: supabase/migrations/0008_barter_deal_update.sql
-- ============================================================
-- Kongsi Dagang — Fase H+: izin update deal barter untuk pihak yang terlibat.
-- APPLY MANUAL oleh Tara di Supabase SQL Editor.

create policy "barter_deals_involved_update" on public.barter_deals
  for update
  using (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  );


-- ============================================================
-- FILE: supabase/migrations/0009_follows.sql
-- ============================================================
-- Kongsi Dagang — Fase H+: Ikuti Loji (follows)
-- APPLY MANUAL / via Management API.

create table if not exists public.follows (
  user_id     uuid not null references auth.users(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, merchant_id)
);

alter table public.follows enable row level security;

create policy "follows_self_all" on public.follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

