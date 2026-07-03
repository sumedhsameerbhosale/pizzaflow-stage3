-- Idempotent re-creation of RLS policies, in case the first run of
-- schema.sql only partially applied them. Safe to run any number of
-- times.

drop policy if exists "menu_items_public_read" on menu_items;
drop policy if exists "orders_public_insert" on orders;
drop policy if exists "orders_authenticated_select" on orders;
drop policy if exists "order_items_public_insert" on order_items;
drop policy if exists "order_items_authenticated_select" on order_items;

alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "menu_items_public_read"
  on menu_items for select
  to anon, authenticated
  using (true);

create policy "orders_public_insert"
  on orders for insert
  to anon, authenticated
  with check (true);

create policy "orders_authenticated_select"
  on orders for select
  to authenticated
  using (true);

create policy "order_items_public_insert"
  on order_items for insert
  to anon, authenticated
  with check (true);

create policy "order_items_authenticated_select"
  on order_items for select
  to authenticated
  using (true);

-- Diagnostic: run this after the above to confirm what's actually
-- registered (paste the result back if inserts still fail):
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename in ('menu_items', 'orders', 'order_items')
order by tablename, cmd;
