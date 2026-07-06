-- Kongsi Dagang — M3: Pundi (ledger keping) + belanja + isi (demo) + tebus voucher
-- APPLY via Management API.

create table if not exists public.wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      integer not null,               -- +isi / -belanja (keping)
  kind        text not null,                  -- isi | belanja | tebus | hadiah
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

alter table public.wallet_transactions enable row level security;
drop policy if exists "wallet_tx_self_read" on public.wallet_transactions;
create policy "wallet_tx_self_read" on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- Belanja: potong saldo (atomik) + catat ledger
create or replace function public.spend_keping(amt integer, note text default 'Belanja')
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if amt is null or amt <= 0 then raise exception 'Jumlah tidak valid'; end if;
  select balance into bal from public.wallets where user_id = auth.uid() for update;
  if bal is null then
    insert into public.wallets(user_id, balance) values (auth.uid(), 0);
    bal := 0;
  end if;
  if bal < amt then raise exception 'Saldo Keping tidak cukup'; end if;
  update public.wallets set balance = balance - amt, updated_at = now() where user_id = auth.uid();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), -amt, 'belanja', note);
  return bal - amt;
end $$;

-- Isi Pundi (DEMO — ganti dengan DOKU di M6)
create or replace function public.topup_demo(amt integer)
returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if amt is null or amt <= 0 or amt > 1000000 then raise exception 'Jumlah tidak valid (maks 1jt demo)'; end if;
  insert into public.wallets(user_id, balance) values (auth.uid(), amt)
    on conflict (user_id) do update set balance = public.wallets.balance + amt, updated_at = now();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), amt, 'isi', 'Isi Pundi (demo)');
  select balance into bal from public.wallets where user_id = auth.uid();
  return bal;
end $$;

-- Tebus Surat Jalan (voucher)
create or replace function public.redeem_voucher(vid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare vtitle text;
begin
  update public.vouchers set status = 'terpakai'
    where id = vid and user_id = auth.uid() and status = 'aktif'
    returning title into vtitle;
  if vtitle is null then raise exception 'Voucher tidak bisa ditebus'; end if;
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), 0, 'tebus', 'Tebus Surat Jalan: ' || vtitle);
end $$;

revoke all on function public.spend_keping(integer, text) from anon;
revoke all on function public.topup_demo(integer) from anon;
revoke all on function public.redeem_voucher(uuid) from anon;
grant execute on function public.spend_keping(integer, text) to authenticated;
grant execute on function public.topup_demo(integer) to authenticated;
grant execute on function public.redeem_voucher(uuid) to authenticated;
