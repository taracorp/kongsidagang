
-- === supabase/migrations/0001_merchants.sql ===
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


-- === supabase/migrations/0002_auctions.sql ===
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


-- === supabase/migrations/0003_price_listings.sql ===
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


-- === supabase/migrations/0004_barter.sql ===
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


-- === supabase/migrations/0005_articles.sql ===
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


-- === supabase/migrations/0006_wallet_admin.sql ===
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


-- === supabase/migrations/0007_settings.sql ===
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


-- === supabase/migrations/0008_barter_deal_update.sql ===
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


-- === supabase/migrations/0009_follows.sql ===
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


-- === supabase/migrations/0010_auto_lelang.sql ===
-- Kongsi Dagang — Fase H+: Timer lelang otomatis (pg_cron + advance_auctions)
-- APPLY via Management API. Fase maju tiap menit, lalu broadcast ke penonton.

alter table public.auctions
  add column if not exists phase_ends_at timestamptz;

-- inisialisasi untuk lelang aktif
update public.auctions
  set phase_ends_at = now() + interval '60 seconds'
  where phase_ends_at is null and status <> 'selesai';

-- Fungsi: majukan fase lelang yang waktunya habis, lalu beri sinyal realtime.
create or replace function public.advance_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  nextstatus text;
begin
  for r in
    select id, status from public.auctions
    where phase_ends_at is not null and phase_ends_at < now()
  loop
    nextstatus := case r.status
      when 'kumpul'   then 'tebak'
      when 'tebak'    then 'jeda'
      when 'jeda'     then 'final'
      when 'final'    then 'pemenang'
      when 'pemenang' then 'bayar'
      when 'bayar'    then 'selesai'
      when 'selesai'  then 'kumpul'
      else 'kumpul'
    end;

    update public.auctions
      set status = nextstatus,
          phase_ends_at = now() + interval '60 seconds'
      where id = r.id;
  end loop;

  -- sinyal ke semua penonton /lelang (abaikan bila realtime tak tersedia)
  begin
    perform realtime.send(
      jsonb_build_object('at', now()),
      'update',
      'kongsi-lelang',
      false
    );
  exception when others then null;
  end;
end;
$$;

-- Jadwalkan tiap menit (pg_cron)
create extension if not exists pg_cron;

do $$ begin
  perform cron.unschedule('advance-auctions');
exception when others then null;
end $$;

select cron.schedule(
  'advance-auctions',
  '* * * * *',
  $$ select public.advance_auctions(); $$
);


-- === supabase/migrations/0011_staff_roles.sql ===
-- Kongsi Dagang — Fase I: Peran staf (Pewarta / Admin Kongsi / Ketua Kongsi)
-- APPLY via Management API.

-- Enum peran staf
do $$ begin
  create type public.staff_role as enum ('pewarta', 'admin', 'ketua');
exception when duplicate_object then null; end $$;

create table if not exists public.staff_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.staff_role not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.staff_roles enable row level security;

-- ===== Helper functions =====
create or replace function public.is_ketua()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'ketua');
$$;

create or replace function public.is_admin_up()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('admin','ketua'));
$$;

create or replace function public.can_edit_kabar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('pewarta','admin','ketua'));
$$;

-- Samakan is_admin() lama -> admin+ketua (agar policy operasional lama tetap berlaku)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('admin','ketua'));
$$;

-- ===== RLS staff_roles =====
drop policy if exists "staff_roles_read" on public.staff_roles;
create policy "staff_roles_read" on public.staff_roles
  for select using (auth.uid() = user_id or public.is_admin_up());

drop policy if exists "staff_roles_ketua_write" on public.staff_roles;
create policy "staff_roles_ketua_write" on public.staff_roles
  for all using (public.is_ketua()) with check (public.is_ketua());

-- ===== Trigger: maksimal 2 Ketua =====
create or replace function public.enforce_max_ketua()
returns trigger language plpgsql as $$
begin
  if new.role = 'ketua' then
    if (select count(*) from public.staff_roles where role = 'ketua' and user_id <> new.user_id) >= 2 then
      raise exception 'Maksimal 2 Ketua Kongsi';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_max_ketua on public.staff_roles;
create trigger trg_max_ketua
  before insert or update on public.staff_roles
  for each row execute function public.enforce_max_ketua();

-- ===== Kabar boleh diedit Pewarta+Admin+Ketua =====
drop policy if exists "articles_admin_write" on public.articles;
create policy "articles_kabar_write" on public.articles
  for all using (public.can_edit_kabar()) with check (public.can_edit_kabar());

-- ===== Daftar user + peran (khusus Ketua) untuk halaman Atur Peran =====
create or replace function public.admin_list_users()
returns table(user_id uuid, email text, full_name text, role public.staff_role)
language sql stable security definer set search_path = public as $$
  select u.id,
         u.email::text,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', '')::text,
         sr.role
  from auth.users u
  left join public.staff_roles sr on sr.user_id = u.id
  left join public.profiles p on p.id = u.id
  where public.is_ketua()
  order by (sr.role is null), u.created_at;
$$;

revoke all on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;


-- === supabase/migrations/0012_approve_merchant.sql ===
-- Kongsi Dagang — Fase I (M1): Approve pengajuan Saudagar -> auto-buat loji + owner + segel
-- APPLY via Management API.

create or replace function public.approve_merchant_application(app_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app        record;
  base_slug  text;
  new_slug   text;
  n          int := 0;
  mid        uuid;
begin
  if not public.is_admin_up() then
    raise exception 'Hanya pengurus yang boleh menyetujui';
  end if;

  select * into app from public.merchant_applications where id = app_id;
  if app is null then
    raise exception 'Pengajuan tidak ditemukan';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(app.loji_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'loji'; end if;
  new_slug := base_slug;
  while exists (select 1 from public.merchants where slug = new_slug) loop
    n := n + 1;
    new_slug := base_slug || '-' || n;
  end loop;

  insert into public.merchants (slug, name, category, owner_id, is_sealed, status, tone, cover_from, cover_to, city)
  values (new_slug, app.loji_name, app.category, app.applicant_id, true, 'buka', 'indigo', 'indigo', 'beeswax', null)
  returning id into mid;

  update public.merchant_applications set status = 'approved' where id = app_id;
  return mid;
end;
$$;

revoke all on function public.approve_merchant_application(uuid) from anon;
grant execute on function public.approve_merchant_application(uuid) to authenticated;


-- === supabase/migrations/0013_auction_engine.sql ===
-- Kongsi Dagang — M2: Mesin lelang sungguhan (pemenang + reveal + Surat Jalan + peserta live)
-- APPLY via Management API.

alter table public.auctions add column if not exists winning_guess integer;

-- Tentukan pemenang: tebakan (terbaru per user) terdekat ke set_price; terbit voucher.
create or replace function public.decide_auction(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  sp  integer;
  cat text;
  win record;
begin
  select set_price, clue_category into sp, cat from public.auctions where id = aid;
  if sp is null then return; end if;

  with latest as (
    select distinct on (user_id) user_id, guess
    from public.auction_guesses
    where auction_id = aid
    order by user_id, created_at desc
  )
  select user_id, guess into win
  from latest
  order by abs(guess - sp) asc, guess asc
  limit 1;

  if win.user_id is null then return; end if;

  update public.auctions
    set winner_id = win.user_id, winning_guess = win.guess
    where id = aid;

  if not exists (
    select 1 from public.vouchers
    where user_id = win.user_id and title = cat and kind = 'lelang'
  ) then
    insert into public.vouchers (user_id, title, note, kind)
    values (win.user_id, cat, 'Menang lelang · tebus segera', 'lelang');
  end if;
end $$;

-- Advance fase + putuskan pemenang saat masuk 'pemenang' + reset saat ulang 'kumpul'
create or replace function public.advance_auctions()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  nextstatus text;
begin
  for r in
    select id, status from public.auctions
    where phase_ends_at is not null and phase_ends_at < now()
  loop
    nextstatus := case r.status
      when 'kumpul'   then 'tebak'
      when 'tebak'    then 'jeda'
      when 'jeda'     then 'final'
      when 'final'    then 'pemenang'
      when 'pemenang' then 'bayar'
      when 'bayar'    then 'selesai'
      when 'selesai'  then 'kumpul'
      else 'kumpul'
    end;

    update public.auctions
      set status = nextstatus, phase_ends_at = now() + interval '60 seconds'
      where id = r.id;

    if nextstatus = 'pemenang' then
      perform public.decide_auction(r.id);
    elsif nextstatus = 'kumpul' then
      update public.auctions set winner_id = null, winning_guess = null where id = r.id;
      delete from public.auction_guesses where auction_id = r.id;
      delete from public.auction_participants where auction_id = r.id;
    end if;
  end loop;

  begin
    perform realtime.send(jsonb_build_object('at', now()), 'update', 'kongsi-lelang', false);
  exception when others then null;
  end;
end $$;

-- View publik: reveal harga & pemenang HANYA setelah diputus + peserta live
drop view if exists public.auction_items_public;
create view public.auction_items_public
with (security_invoker = false) as
  select
    a.id, a.type, a.clue_category, a.clue_name_masked, a.normal_price,
    a.facilities, a.status, a.capacity, a.starts_at, a.created_at, a.winner_id,
    case when a.status in ('pemenang','bayar','selesai') then a.set_price end as revealed_price,
    case when a.status in ('pemenang','bayar','selesai') then a.winning_guess end as winning_guess,
    (select coalesce(p.full_name, split_part(u.email,'@',1))
       from auth.users u left join public.profiles p on p.id = u.id
       where u.id = a.winner_id) as winner_name,
    (select count(*) from public.auction_participants ap where ap.auction_id = a.id) as peserta_count
  from public.auctions a;

grant select on public.auction_items_public to anon, authenticated;


-- === supabase/migrations/0014_pundi_ledger.sql ===
-- Kongsi Dagang — M3: Pundi (ledger keping) + belanja + isi (demo) + tebus voucher
-- APPLY via Management API.

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      integer not null,               -- +isi / -belanja (keping)
  kind        text not null,                  -- isi | belanja | tebus | hadiah
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet_tx_self_read" on public.wallet_transactions;
create policy "wallet_tx_self_read" on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- Belanja: potong saldo (atomik) + catat ledger
create or replace function public.spend_keping(amt integer, note text default 'Belanja')
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if amt is null or amt <= 0 then raise exception 'Jumlah tidak valid'; end if;
  select balance into bal from public.wallets where user_id = auth.uid() for update;
  if bal is null then
    insert into public.wallets(user_id, balance) values (auth.uid(), 0);
    bal := 0;
  end if;
  if bal < amt then raise exception 'Saldo Keping tidak cukup'; end if;
  update public.wallets set balance = balance - amt, updated_at = now() where user_id = auth.uid();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), -amt, 'belanja', note);
  return bal - amt;
end $$;

-- Isi Pundi (DEMO — ganti dengan DOKU di M6)
create or replace function public.topup_demo(amt integer)
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if amt is null or amt <= 0 or amt > 1000000 then raise exception 'Jumlah tidak valid (maks 1jt demo)'; end if;
  insert into public.wallets(user_id, balance) values (auth.uid(), amt)
    on conflict (user_id) do update set balance = public.wallets.balance + amt, updated_at = now();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), amt, 'isi', 'Isi Pundi (demo)');
  select balance into bal from public.wallets where user_id = auth.uid();
  return bal;
end $$;

-- Tebus Surat Jalan (voucher)
create or replace function public.redeem_voucher(vid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare vtitle text;
begin
  update public.vouchers set status = 'terpakai'
    where id = vid and user_id = auth.uid() and status = 'aktif'
    returning title into vtitle;
  if vtitle is null then raise exception 'Voucher tidak bisa ditebus'; end if;
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), 0, 'tebus', 'Tebus Surat Jalan: ' || vtitle);
end $$;

revoke all on function public.spend_keping(integer, text) from anon;
revoke all on function public.topup_demo(integer) from anon;
revoke all on function public.redeem_voucher(uuid) from anon;
grant execute on function public.spend_keping(integer, text) to authenticated;
grant execute on function public.topup_demo(integer) to authenticated;
grant execute on function public.redeem_voucher(uuid) to authenticated;


-- === supabase/migrations/0015_level_loyalti.sql ===
-- Kongsi Dagang — M4: Level & Loyalti (akumulasi belanja -> level, potongan bea, Cap)
-- APPLY via Management API.
-- Ambang (rupiah akumulasi belanja): kecil 0 | besar 250rb | tuan_kecil 1jt | tuan_besar 5jt | juragan 20jt

alter table public.profiles add column if not exists total_spend integer not null default 0;

-- backfill dari transaksi belanja yang sudah ada
update public.profiles p set total_spend = coalesce((
  select sum(-wt.amount) from public.wallet_transactions wt
  where wt.user_id = p.id and wt.kind = 'belanja'
), 0);

create or replace function public.recompute_level(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set level = (case
    when total_spend >= 20000000 then 'juragan'
    when total_spend >= 5000000  then 'tuan_besar'
    when total_spend >= 1000000  then 'tuan_kecil'
    when total_spend >= 250000   then 'pelanggan_besar'
    else 'pelanggan_kecil'
  end)::public.user_level
  where id = uid;
end $$;

-- set level awal sesuai backfill
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.recompute_level(r.id);
  end loop;
end $$;

-- Checkout pakai Keping dengan hak per-level + Cap (potongan bea)
create or replace function public.checkout_keping(p_subtotal integer, p_ongkir integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prof record;
  bea integer := 2000;
  used_stamp boolean := false;
  total integer;
  bal integer;
begin
  if p_subtotal is null or p_subtotal <= 0 then raise exception 'Keranjang kosong'; end if;

  select level, stamps, total_spend into prof from public.profiles where id = auth.uid();
  if prof is null then
    insert into public.profiles(id) values (auth.uid());
    select level, stamps, total_spend into prof from public.profiles where id = auth.uid();
  end if;

  if prof.level in ('tuan_besar','juragan') then
    bea := 0;                       -- hak level
  elsif prof.stamps >= 10 then
    bea := 0; used_stamp := true;   -- tukar 10 Cap
  end if;

  total := p_subtotal + coalesce(p_ongkir, 0) + bea;

  select balance into bal from public.wallets where user_id = auth.uid() for update;
  if bal is null then insert into public.wallets(user_id, balance) values (auth.uid(), 0); bal := 0; end if;
  if bal < total then raise exception 'Saldo Keping tidak cukup'; end if;

  update public.wallets set balance = balance - total, updated_at = now() where user_id = auth.uid();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), -total, 'belanja', 'Belanja Kongsi');

  update public.profiles
    set total_spend = total_spend + total,
        stamps = case when used_stamp then stamps - 10 + 1 else stamps + 1 end
    where id = auth.uid();

  perform public.recompute_level(auth.uid());

  return jsonb_build_object('paid', total, 'bea', bea, 'used_stamp', used_stamp);
end $$;

revoke all on function public.checkout_keping(integer, integer) from anon;
grant execute on function public.checkout_keping(integer, integer) to authenticated;


-- === supabase/migrations/0016_tukar_matang.sql ===
-- Kongsi Dagang — M5: Tukar Guling matang (foto Storage + rating + sengketa)
-- APPLY via Management API.

-- ===== Storage: bucket foto barter (publik baca, unggah folder milik sendiri) =====
insert into storage.buckets (id, name, public)
values ('barter', 'barter', true)
on conflict (id) do nothing;

drop policy if exists "barter_obj_read" on storage.objects;
create policy "barter_obj_read" on storage.objects
  for select using (bucket_id = 'barter');

drop policy if exists "barter_obj_insert_own" on storage.objects;
create policy "barter_obj_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'barter' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "barter_obj_delete_own" on storage.objects;
create policy "barter_obj_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'barter' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Rating antar pihak =====
create table if not exists public.barter_ratings (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.barter_deals(id) on delete cascade,
  rater_id    uuid not null references auth.users(id) on delete cascade,
  ratee_id    uuid not null references auth.users(id) on delete cascade,
  stars       int not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (deal_id, rater_id)
);
alter table public.barter_ratings enable row level security;

drop policy if exists "barter_ratings_read" on public.barter_ratings;
create policy "barter_ratings_read" on public.barter_ratings for select using (true);

-- Beri nilai (pihak deal saja; ratee dihitung otomatis)
create or replace function public.rate_deal(p_deal uuid, p_stars int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a_uid uuid; b_uid uuid; ratee uuid;
begin
  select ia.user_id, ib.user_id into a_uid, b_uid
  from public.barter_deals d
  join public.barter_items ia on ia.id = d.item_a
  join public.barter_items ib on ib.id = d.item_b
  where d.id = p_deal;
  if auth.uid() not in (a_uid, b_uid) then raise exception 'Bukan pihak deal ini'; end if;
  ratee := case when auth.uid() = a_uid then b_uid else a_uid end;
  insert into public.barter_ratings(deal_id, rater_id, ratee_id, stars, comment)
  values (p_deal, auth.uid(), ratee, p_stars, p_comment)
  on conflict (deal_id, rater_id) do update set stars = excluded.stars, comment = excluded.comment;
end $$;

revoke all on function public.rate_deal(uuid, int, text) from anon;
grant execute on function public.rate_deal(uuid, int, text) to authenticated;

