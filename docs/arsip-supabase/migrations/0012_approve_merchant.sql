-- Kongsi Dagang — Fase I (M1): Approve pengajuan Saudagar -> auto-buat loji + owner + segel
-- APPLY via Management API.

create or replace function public.approve_merchant_application(app_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  app        record;
  base_slug  text;
  new_slug   text;
  n          int := 0;
  mid        uuid;
begin
  if not public.is_admin_up() then
    raise exception 'Hanya pengurus yang boleh menyetujui';
  end if;

  select * into app from public.merchant_applications where id = app_id;
  if app is null then
    raise exception 'Pengajuan tidak ditemukan';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(app.loji_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'loji'; end if;
  new_slug := base_slug;
  while exists (select 1 from public.merchants where slug = new_slug) loop
    n := n + 1;
    new_slug := base_slug || '-' || n;
  end loop;

  insert into public.merchants (slug, name, category, owner_id, is_sealed, status, tone, cover_from, cover_to, city)
  values (new_slug, app.loji_name, app.category, app.applicant_id, true, 'buka', 'indigo', 'indigo', 'beeswax', null)
  returning id into mid;

  update public.merchant_applications set status = 'approved' where id = app_id;
  return mid;
end;
$$;

revoke all on function public.approve_merchant_application(uuid) from anon;
grant execute on function public.approve_merchant_application(uuid) to authenticated;
