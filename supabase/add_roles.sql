-- ============================================================
-- Incremental migration: adds staff vs admin roles.
--
-- Role lives in Supabase Auth's app_metadata (auth.users.raw_app_meta_data
-- ->> 'role'), which Supabase automatically embeds in each user's JWT
-- as `app_metadata` -- no new table needed, RLS reads it straight off
-- the token via auth.jwt().
--
-- Two roles:
--   - staff (the default when 'role' is unset): can place orders via
--     the `/` page, cannot read order history, insights, or change
--     settings.
--   - admin: everything staff can do, plus /admin/* (order history,
--     insights, settings).
--
-- IMPORTANT: unset role now means "staff" (least privilege) -- this is
-- a behavior change from before this migration, where every
-- authenticated user had full access. Any existing account that
-- should keep admin access must be explicitly promoted:
--
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
--   where email = 'someone@example.com';
--
-- Anyone already logged in when their role changes needs to log out
-- and back in -- their existing session's JWT was issued before the
-- update and won't reflect it until a fresh sign-in.
--
-- Safe to run any number of times.
-- ============================================================

drop policy if exists "orders_authenticated_select" on orders;
create policy "orders_admin_select"
  on orders for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "order_items_authenticated_select" on order_items;
create policy "order_items_admin_select"
  on order_items for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "app_settings_authenticated_update" on app_settings;
create policy "app_settings_admin_update"
  on app_settings for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- orders/order_items INSERT stays open to any authenticated user --
-- staff place orders too. No change needed there.

-- Diagnostic: confirm the new policies replaced the old ones.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename in ('orders', 'order_items', 'app_settings')
order by tablename, cmd;
