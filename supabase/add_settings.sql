-- ============================================================
-- Incremental migration: adds the app_settings table to an already
-- set-up PizzaFlow project (i.e. one where schema.sql + seed.sql have
-- already run). Safe to run once; re-running is a no-op thanks to
-- `if not exists` / `on conflict do nothing`.
--
-- Adds a live-editable discount quantity threshold, changeable from
-- /admin/settings with no code deploy -- see schema.sql for the same
-- table definition (kept in sync there for fresh project setups).
-- ============================================================

create table if not exists app_settings (
  id boolean primary key default true,
  discount_qty_threshold integer not null default 5 check (discount_qty_threshold between 1 and 10),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id, discount_qty_threshold)
values (true, 5)
on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "app_settings_public_read" on app_settings;
drop policy if exists "app_settings_authenticated_update" on app_settings;

create policy "app_settings_public_read"
  on app_settings for select
  to anon, authenticated
  using (true);

create policy "app_settings_authenticated_update"
  on app_settings for update
  to authenticated
  using (true)
  with check (true);

-- Diagnostic: confirm the row and policies exist.
select * from app_settings;
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where tablename = 'app_settings'
order by cmd;
