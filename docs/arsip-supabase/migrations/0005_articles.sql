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
