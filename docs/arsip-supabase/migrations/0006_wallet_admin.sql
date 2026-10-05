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
