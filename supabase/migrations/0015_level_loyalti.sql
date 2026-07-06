-- Kongsi Dagang — M4: Level & Loyalti (akumulasi belanja -> level, potongan bea, Cap)
-- APPLY via Management API.
-- Ambang (rupiah akumulasi belanja): kecil 0 | besar 250rb | tuan_kecil 1jt | tuan_besar 5jt | juragan 20jt

alter table public.profiles add column if not exists total_spend integer not null default 0;

-- backfill dari transaksi belanja yang sudah ada
update public.profiles p set total_spend = coalesce((
  select sum(-wt.amount) from public.wallet_transactions wt
  where wt.user_id = p.id and wt.kind = 'belanja'
), 0);

create or replace function public.recompute_level(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set level = (case
    when total_spend >= 20000000 then 'juragan'
    when total_spend >= 5000000  then 'tuan_besar'
    when total_spend >= 1000000  then 'tuan_kecil'
    when total_spend >= 250000   then 'pelanggan_besar'
    else 'pelanggan_kecil'
  end)::public.user_level
  where id = uid;
end $$;

-- set level awal sesuai backfill
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.recompute_level(r.id);
  end loop;
end $$;

-- Checkout pakai Keping dengan hak per-level + Cap (potongan bea)
create or replace function public.checkout_keping(p_subtotal integer, p_ongkir integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prof record;
  bea integer := 2000;
  used_stamp boolean := false;
  total integer;
  bal integer;
begin
  if p_subtotal is null or p_subtotal <= 0 then raise exception 'Keranjang kosong'; end if;

  select level, stamps, total_spend into prof from public.profiles where id = auth.uid();
  if prof is null then
    insert into public.profiles(id) values (auth.uid());
    select level, stamps, total_spend into prof from public.profiles where id = auth.uid();
  end if;

  if prof.level in ('tuan_besar','juragan') then
    bea := 0;                       -- hak level
  elsif prof.stamps >= 10 then
    bea := 0; used_stamp := true;   -- tukar 10 Cap
  end if;

  total := p_subtotal + coalesce(p_ongkir, 0) + bea;

  select balance into bal from public.wallets where user_id = auth.uid() for update;
  if bal is null then insert into public.wallets(user_id, balance) values (auth.uid(), 0); bal := 0; end if;
  if bal < total then raise exception 'Saldo Keping tidak cukup'; end if;

  update public.wallets set balance = balance - total, updated_at = now() where user_id = auth.uid();
  insert into public.wallet_transactions(user_id, amount, kind, note)
    values (auth.uid(), -total, 'belanja', 'Belanja Kongsi');

  update public.profiles
    set total_spend = total_spend + total,
        stamps = case when used_stamp then stamps - 10 + 1 else stamps + 1 end
    where id = auth.uid();

  perform public.recompute_level(auth.uid());

  return jsonb_build_object('paid', total, 'bea', bea, 'used_stamp', used_stamp);
end $$;

revoke all on function public.checkout_keping(integer, integer) from anon;
grant execute on function public.checkout_keping(integer, integer) to authenticated;
