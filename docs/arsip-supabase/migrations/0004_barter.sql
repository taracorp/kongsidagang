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
