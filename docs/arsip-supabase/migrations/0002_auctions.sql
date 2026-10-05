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
