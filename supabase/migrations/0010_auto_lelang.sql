-- Kongsi Dagang — Fase H+: Timer lelang otomatis (pg_cron + advance_auctions)
-- APPLY via Management API. Fase maju tiap menit, lalu broadcast ke penonton.

alter table public.auctions
  add column if not exists phase_ends_at timestamptz;

-- inisialisasi untuk lelang aktif
update public.auctions
  set phase_ends_at = now() + interval '60 seconds'
  where phase_ends_at is null and status <> 'selesai';

-- Fungsi: majukan fase lelang yang waktunya habis, lalu beri sinyal realtime.
create or replace function public.advance_auctions()
returns void
language plpgsql
security definer
set search_path = public
as $$
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
      set status = nextstatus,
          phase_ends_at = now() + interval '60 seconds'
      where id = r.id;
  end loop;

  -- sinyal ke semua penonton /lelang (abaikan bila realtime tak tersedia)
  begin
    perform realtime.send(
      jsonb_build_object('at', now()),
      'update',
      'kongsi-lelang',
      false
    );
  exception when others then null;
  end;
end;
$$;

-- Jadwalkan tiap menit (pg_cron)
create extension if not exists pg_cron;

do $$ begin
  perform cron.unschedule('advance-auctions');
exception when others then null;
end $$;

select cron.schedule(
  'advance-auctions',
  '* * * * *',
  $$ select public.advance_auctions(); $$
);
