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
