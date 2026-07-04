-- ============================================================
-- Incremental migration: tightens orders/order_items INSERT from
-- `anon, authenticated` to `authenticated` only.
--
-- Context: Stage 3 originally allowed anon INSERT because the order
-- page (`/`) had no auth gate -- counter staff placed orders without
-- logging in. `/` is now gated by src/proxy.ts (same Supabase Auth
-- session used for /admin/*), so anon can no longer reach the order
-- form at all; this closes the remaining loophole of a direct,
-- unauthenticated POST to /api/orders.
--
-- Safe to run any number of times.
-- ============================================================

drop policy if exists "orders_public_insert" on orders;
drop policy if exists "order_items_public_insert" on order_items;

create policy "orders_authenticated_insert"
  on orders for insert
  to authenticated
  with check (true);

create policy "order_items_authenticated_insert"
  on order_items for insert
  to authenticated
  with check (true);

-- Diagnostic: confirm the new policies replaced the old ones.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename in ('orders', 'order_items')
order by tablename, cmd;
