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
