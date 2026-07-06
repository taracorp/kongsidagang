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
