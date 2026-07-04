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
