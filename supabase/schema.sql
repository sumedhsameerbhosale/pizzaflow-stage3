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

-- menu_items: public read only.
-- Counter staff place orders without logging in (Stage 1's own assumption),
-- so anyone loading the order page must be able to read the menu without
-- auth. No public writes -- menu changes are a DB-console operation only.
create policy "menu_items_public_read"
  on menu_items for select
  to anon, authenticated
  using (true);

-- orders: INSERT and SELECT both restricted to authenticated.
-- The order page (`/`) is gated by src/proxy.ts behind the same
-- Supabase Auth session used for /admin/*, so counter staff must log
-- in before they can place an order. Reading back all orders (customer
-- names, phones, revenue) is the admin view, gated the same way.
create policy "orders_authenticated_insert"
  on orders for insert
  to authenticated
  with check (true);

create policy "orders_authenticated_select"
  on orders for select
  to authenticated
  using (true);

-- order_items: same reasoning as orders.
create policy "order_items_authenticated_insert"
  on order_items for insert
  to authenticated
  with check (true);

create policy "order_items_authenticated_select"
  on order_items for select
  to authenticated
  using (true);

-- app_settings: public read (the unauthenticated order flow needs the
-- live threshold to price a bill), write restricted to authenticated
-- (admin) sessions only -- the /admin/settings page is itself gated by
-- proxy.ts, and this policy is the defense-in-depth backstop, same
-- pattern as every other write in this schema.
create policy "app_settings_public_read"
  on app_settings for select
  to anon, authenticated
  using (true);

create policy "app_settings_authenticated_update"
  on app_settings for update
  to authenticated
  using (true)
  with check (true);

-- No UPDATE/DELETE policies are defined for anon or authenticated on
-- menu_items/orders/order_items -- RLS denies by default when no policy
-- matches, so those are effectively append-only from the app's
-- perspective (mirrors Stage 2's log-only, no-edit behavior). All order
-- writes go through the anon INSERT policy via the server-side
-- /api/orders route handler -- no service-role key is needed anywhere
-- at runtime.
