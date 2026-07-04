-- ============================================================
-- Incremental migration: adds admin-only INSERT and UPDATE policies
-- on menu_items, enabling /admin/menu to create and edit items without
-- going through the Supabase SQL editor.
--
-- No DELETE policy is added on purpose -- menu items are soft-deactivated
-- via the existing `is_active` flag (see /admin/menu, MenuManager.tsx),
-- never hard-deleted. This also avoids ever having to worry about
-- order_items.menu_item_id rows going null out from under order history.
--
-- Same (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' check used by
-- every other admin-gated write in this schema (see add_roles.sql).
--
-- Safe to run any number of times.
-- ============================================================

drop policy if exists "menu_items_admin_insert" on menu_items;
drop policy if exists "menu_items_admin_update" on menu_items;

create policy "menu_items_admin_insert"
  on menu_items for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "menu_items_admin_update"
  on menu_items for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Diagnostic: confirm the new policies exist alongside the original
-- public-read policy.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename = 'menu_items'
order by cmd;
