-- Kongsi Dagang — Fase H+: izin update deal barter untuk pihak yang terlibat.
-- APPLY MANUAL oleh Tara di Supabase SQL Editor.

create policy "barter_deals_involved_update" on public.barter_deals
  for update
  using (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.barter_items i
            where i.id in (item_a, item_b) and i.user_id = auth.uid())
  );
