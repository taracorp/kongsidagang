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
