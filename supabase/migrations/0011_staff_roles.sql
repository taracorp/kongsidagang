-- Kongsi Dagang — Fase I: Peran staf (Pewarta / Admin Kongsi / Ketua Kongsi)
-- APPLY via Management API.

-- Enum peran staf
do $$ begin
  create type public.staff_role as enum ('pewarta', 'admin', 'ketua');
exception when duplicate_object then null; end $$;

create table if not exists public.staff_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.staff_role not null,
  granted_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.staff_roles enable row level security;

-- ===== Helper functions =====
create or replace function public.is_ketua()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role = 'ketua');
$$;

create or replace function public.is_admin_up()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('admin','ketua'));
$$;

create or replace function public.can_edit_kabar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('pewarta','admin','ketua'));
$$;

-- Samakan is_admin() lama -> admin+ketua (agar policy operasional lama tetap berlaku)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid() and role in ('admin','ketua'));
$$;

-- ===== RLS staff_roles =====
drop policy if exists "staff_roles_read" on public.staff_roles;
create policy "staff_roles_read" on public.staff_roles
  for select using (auth.uid() = user_id or public.is_admin_up());

drop policy if exists "staff_roles_ketua_write" on public.staff_roles;
create policy "staff_roles_ketua_write" on public.staff_roles
  for all using (public.is_ketua()) with check (public.is_ketua());

-- ===== Trigger: maksimal 2 Ketua =====
create or replace function public.enforce_max_ketua()
returns trigger language plpgsql as $$
begin
  if new.role = 'ketua' then
    if (select count(*) from public.staff_roles where role = 'ketua' and user_id <> new.user_id) >= 2 then
      raise exception 'Maksimal 2 Ketua Kongsi';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_max_ketua on public.staff_roles;
create trigger trg_max_ketua
  before insert or update on public.staff_roles
  for each row execute function public.enforce_max_ketua();

-- ===== Kabar boleh diedit Pewarta+Admin+Ketua =====
drop policy if exists "articles_admin_write" on public.articles;
create policy "articles_kabar_write" on public.articles
  for all using (public.can_edit_kabar()) with check (public.can_edit_kabar());

-- ===== Daftar user + peran (khusus Ketua) untuk halaman Atur Peran =====
create or replace function public.admin_list_users()
returns table(user_id uuid, email text, full_name text, role public.staff_role)
language sql stable security definer set search_path = public as $$
  select u.id,
         u.email::text,
         coalesce(p.full_name, u.raw_user_meta_data->>'full_name', '')::text,
         sr.role
  from auth.users u
  left join public.staff_roles sr on sr.user_id = u.id
  left join public.profiles p on p.id = u.id
  where public.is_ketua()
  order by (sr.role is null), u.created_at;
$$;

revoke all on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;
