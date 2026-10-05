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
