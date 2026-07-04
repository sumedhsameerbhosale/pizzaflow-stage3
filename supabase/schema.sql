-- ============================================================
-- PizzaFlow Stage 3 schema
-- Three separate tables per the assignment requirement:
-- menu_items, orders, order_items.
-- Run this once in the Supabase SQL editor before seed.sql.
-- ============================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------- menu_items ----------
-- Replaces the Stage 2 .txt files. Loaded at runtime by the ordering UI.
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('base', 'pizza', 'topping')),
  name text not null,
  price numeric(10,2) not null check (price > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- orders ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  quantity integer not null check (quantity >= 1 and quantity <= 10),
  unit_total numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  discount_rate numeric(4,2) not null,
  discount_amount numeric(10,2) not null,
  post_discount_total numeric(10,2) not null,
  gst_amount numeric(10,2) not null,
  grand_total numeric(10,2) not null,
  payment_mode text not null check (payment_mode in ('Cash', 'Card', 'UPI')),
  created_at timestamptz not null default now()
);

-- ---------- order_items ----------
-- One row per line (base / pizza / topping) attached to an order.
-- Name + price are captured AT TIME OF ORDER (denormalized on purpose --
-- menu prices may change later, order history must not).
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  category text not null check (category in ('base', 'pizza', 'topping')),
  item_name text not null,
  unit_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_orders_created_at on orders(created_at);

-- ---------- app_settings ----------
-- Singleton table (the `id boolean primary key default true` + the
-- `check (id)` constraint mean id can only ever be `true`, so exactly
-- one row can ever exist) holding admin-editable business rules that
-- would otherwise be hardcoded constants -- currently just the bulk
-- discount quantity threshold, changeable live from /admin/settings
-- with no code deploy needed.
create table if not exists app_settings (
  id boolean primary key default true,
  discount_qty_threshold integer not null default 5 check (discount_qty_threshold between 1 and 10),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id, discount_qty_threshold)
values (true, 5)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table app_settings enable row level security;

-- menu_items: public read for everyone; admin-only insert/update for
-- managing the catalog from /admin/menu (see add_menu_admin_write.sql).
-- No delete policy -- items are soft-deactivated via is_active, never
-- hard-deleted.
create policy "menu_items_public_read"
  on menu_items for select
  to anon, authenticated
  using (true);

create policy "menu_items_admin_insert"
  on menu_items for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "menu_items_admin_update"
  on menu_items for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- orders: INSERT open to any authenticated user (staff place orders
-- too, via `/`, gated by src/proxy.ts). SELECT requires the "admin"
-- role in app_metadata (see supabase/add_roles.sql) -- reading back all
-- orders (customer names, phones, revenue) is the admin-only view.
create policy "orders_authenticated_insert"
  on orders for insert
  to authenticated
  with check (true);

create policy "orders_admin_select"
  on orders for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- order_items: same reasoning as orders.
create policy "order_items_authenticated_insert"
  on order_items for insert
  to authenticated
  with check (true);

create policy "order_items_admin_select"
  on order_items for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- app_settings: public read (the order flow needs the live threshold
-- to price a bill), write restricted to the "admin" role -- the
-- /admin/settings page itself is gated by proxy.ts (staff can't even
-- reach it), and this policy is the defense-in-depth backstop, same
-- pattern as every other write in this schema.
create policy "app_settings_public_read"
  on app_settings for select
  to anon, authenticated
  using (true);

create policy "app_settings_admin_update"
  on app_settings for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- No UPDATE/DELETE policies are defined for anon or authenticated on
-- orders/order_items -- RLS denies by default when no policy matches,
-- so those two tables are effectively append-only from the app's
-- perspective (mirrors Stage 2's log-only, no-edit behavior). menu_items
-- is the one exception, with admin-only insert/update above. All order
-- writes go through the place_order() function below, called via the
-- server-side /api/orders route handler -- no service-role key is
-- needed anywhere at runtime.

-- ============================================================
-- place_order(): inserts an orders row and its order_items rows in one
-- atomic transaction (a failure partway through rolls back the whole
-- call, so an order can never end up with missing line items).
-- security invoker (the default, stated explicitly for clarity) so it
-- runs with the CALLER's privileges -- the RLS policies above
-- (orders_authenticated_insert, order_items_authenticated_insert) are
-- still the real authorization boundary, not bypassed.
-- ============================================================

create or replace function place_order(
  p_order_id uuid,
  p_customer_name text,
  p_phone text,
  p_quantity integer,
  p_unit_total numeric(10,2),
  p_subtotal numeric(10,2),
  p_discount_rate numeric(4,2),
  p_discount_amount numeric(10,2),
  p_post_discount_total numeric(10,2),
  p_gst_amount numeric(10,2),
  p_grand_total numeric(10,2),
  p_payment_mode text,
  p_order_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into orders (
    id, customer_name, phone, quantity, unit_total, subtotal,
    discount_rate, discount_amount, post_discount_total, gst_amount,
    grand_total, payment_mode
  ) values (
    p_order_id, p_customer_name, p_phone, p_quantity, p_unit_total, p_subtotal,
    p_discount_rate, p_discount_amount, p_post_discount_total, p_gst_amount,
    p_grand_total, p_payment_mode
  );

  insert into order_items (order_id, menu_item_id, category, item_name, unit_price)
  select
    p_order_id,
    (item->>'menu_item_id')::uuid,
    item->>'category',
    item->>'item_name',
    (item->>'unit_price')::numeric(10,2)
  from jsonb_array_elements(p_order_items) as item;
end;
$$;

grant execute on function place_order(
  uuid, text, text, integer, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, text, jsonb
) to authenticated;
