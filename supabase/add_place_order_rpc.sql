-- ============================================================
-- Incremental migration: adds a place_order() Postgres function so
-- /api/orders can insert the orders row and its 3 order_items rows in
-- one atomic transaction via supabase.rpc("place_order", ...), instead
-- of two separate .insert() calls that could partially fail (orphaned
-- orders row with no line items).
--
-- Deliberately NOT `security definer` -- it must run with the CALLER's
-- privileges (the authenticated user's own role/JWT), so the existing
-- RLS policies (`orders_authenticated_insert`,
-- `order_items_authenticated_insert`, both `to authenticated with check
-- (true)`) are still the real authorization boundary and are not
-- bypassed.
--
-- Parameters mirror orders' columns 1:1, plus a jsonb array of exactly
-- the 3 order_items rows (base/pizza/topping) the caller has already
-- priced and validated server-side in route.ts -- this function does
-- NOT re-derive prices or re-validate menu item ids; that
-- responsibility stays in route.ts.
--
-- Safe to run any number of times.
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

-- PostgREST only exposes RPCs to roles explicitly granted EXECUTE.
-- Same population that can INSERT into orders/order_items today.
grant execute on function place_order(
  uuid, text, text, integer, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, text, jsonb
) to authenticated;

-- Diagnostic: confirm the function and its grants exist.
select proname, prosecdef, proacl
from pg_proc
where proname = 'place_order';
