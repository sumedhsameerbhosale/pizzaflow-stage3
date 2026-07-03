-- ============================================================
-- PizzaFlow Stage 3 seed data
-- Run this once in the Supabase SQL editor AFTER schema.sql.
--
-- Populates:
--   1. The menu (same items/prices as the Stage 2 .txt files).
--   2. ~35 realistic historical orders spread over the last 2 weeks,
--      with a genuine Saturday 19:00-21:00 peak built in, so the
--      Insights Dashboard AI feature has real signal to summarize on
--      demo day (Stage 1's own risk log flags real data as sparse
--      this early -- this seed data exists specifically to cover that).
--   3. 2 deliberately broken historical orders ("Test Anomaly One/Two")
--      so the Anomaly Flagging feature has guaranteed, demonstrable
--      hits instead of hoping a real billing bug occurs by chance.
-- ============================================================

-- ---------- 1. Menu items (identical to Stage 2's .txt files) ----------

insert into menu_items (category, name, price) values
  ('base', 'Thin Crust', 149),
  ('base', 'Thick Crust', 169),
  ('base', 'Whole Wheat', 189),
  ('base', 'Multigrain', 209),
  ('base', 'Cheese Burst', 229);

insert into menu_items (category, name, price) values
  ('pizza', 'Margherita', 299),
  ('pizza', 'Farm House', 319),
  ('pizza', 'Paneer Tikka', 329),
  ('pizza', 'Greek Mediterranean', 339),
  ('pizza', 'BBQ Chicken', 349),
  ('pizza', 'California Veggie', 359),
  ('pizza', 'Chicago Deep Dish', 369),
  ('pizza', 'Pepperoni Classic', 379);

insert into menu_items (category, name, price) values
  ('topping', 'Sweet Corn', 39),
  ('topping', 'Button Mushrooms', 45),
  ('topping', 'Green Peppers', 45),
  ('topping', 'Black Olives', 49),
  ('topping', 'Caramelised Onions', 49),
  ('topping', 'Jalapenos', 55),
  ('topping', 'Sun-Dried Tomatoes', 59),
  ('topping', 'Roasted Garlic', 59),
  ('topping', 'Extra Cheese', 65),
  ('topping', 'Peri-Peri Drizzle', 69);

-- ---------- 2. ~35 realistic historical orders ----------

do $$
declare
  i integer;
  new_order_id uuid;
  base_row record;
  pizza_row record;
  topping_row record;
  qty integer;
  unit_total numeric(10,2);
  subtotal numeric(10,2);
  discount_rate numeric(4,2);
  discount_amount numeric(10,2);
  post_discount_total numeric(10,2);
  gst_amount numeric(10,2);
  grand_total numeric(10,2);
  payment text;
  order_ts timestamptz;
  is_peak boolean;
  customer text;
begin
  for i in 1..35 loop
    select id, name, price into base_row from menu_items where category = 'base' order by random() limit 1;
    select id, name, price into pizza_row from menu_items where category = 'pizza' order by random() limit 1;
    select id, name, price into topping_row from menu_items where category = 'topping' order by random() limit 1;

    qty := 1 + floor(random() * 10)::int;

    -- First 8 generated orders are deliberately biased into a genuine
    -- Saturday 19:00-21:00 window (one of the last 2 Saturdays) so the
    -- "peak hour" insight has a real signal instead of pure noise.
    is_peak := i <= 8;
    if is_peak then
      order_ts := date_trunc('week', now() - ((floor(random() * 2)::int + 1) * interval '7 days'))
                  + interval '5 days'
                  + ((19 + floor(random() * 2)::int) || ' hours')::interval
                  + ((floor(random() * 55)::int) || ' minutes')::interval;
    else
      order_ts := now()
                  - (random() * interval '14 days')
                  - ((floor(random() * 24)::int) || ' hours')::interval;
    end if;

    unit_total := base_row.price + pizza_row.price + topping_row.price;
    subtotal := unit_total * qty;
    discount_rate := case when qty >= 5 then 0.10 else 0.0 end;
    discount_amount := round(subtotal * discount_rate, 2);
    post_discount_total := round(subtotal - discount_amount, 2);
    gst_amount := round(post_discount_total * 0.18, 2);
    grand_total := round(post_discount_total + gst_amount, 2);
    payment := (array['Cash', 'Card', 'UPI'])[1 + floor(random() * 3)::int];
    customer := (array[
      'Rahul Sharma', 'Ananya Iyer', 'Vikram Rao', 'Priya Nair', 'Karan Mehta',
      'Sneha Kulkarni', 'Arjun Reddy', 'Divya Menon', 'Rohan Kapoor', 'Ishita Singh',
      'Aditya Verma', 'Neha Joshi', 'Siddharth Rao', 'Meera Pillai', 'Varun Chawla'
    ])[1 + floor(random() * 15)::int];

    insert into orders (
      customer_name, phone, quantity, unit_total, subtotal, discount_rate,
      discount_amount, post_discount_total, gst_amount, grand_total,
      payment_mode, created_at
    ) values (
      customer,
      '9' || lpad(floor(random() * 900000000)::bigint::text, 9, '0'),
      qty, unit_total, subtotal, discount_rate, discount_amount,
      post_discount_total, gst_amount, grand_total, payment, order_ts
    ) returning id into new_order_id;

    insert into order_items (order_id, menu_item_id, category, item_name, unit_price) values
      (new_order_id, base_row.id, 'base', base_row.name, base_row.price),
      (new_order_id, pizza_row.id, 'pizza', pizza_row.name, pizza_row.price),
      (new_order_id, topping_row.id, 'topping', topping_row.name, topping_row.price);
  end loop;
end $$;

-- ---------- 3. Two deliberately broken orders for Anomaly Flagging ----------
-- Written as a plain do-block (not psql's \gset) so this runs unmodified
-- in the Supabase Dashboard's SQL Editor, which only executes plain SQL.

do $$
declare
  anomaly_a_id uuid;
  anomaly_b_id uuid;
begin
  -- Anomaly A: quantity 6 should trigger the 10% discount (Stage 1's own
  -- pain point: "the first thing forgotten" during a rush) -- but this
  -- record shows discount_amount = 0 and GST computed on the
  -- un-discounted subtotal. Triggers DISCOUNT_MISMATCH.
  insert into orders (
    customer_name, phone, quantity, unit_total, subtotal, discount_rate,
    discount_amount, post_discount_total, gst_amount, grand_total,
    payment_mode, created_at
  ) values (
    'Test Anomaly One', '9812345601', 6, 637.00, 3822.00, 0.00,
    0.00, 3822.00, 687.96, 4509.96,
    'Cash', now() - interval '18 hours'
  ) returning id into anomaly_a_id;

  insert into order_items (order_id, menu_item_id, category, item_name, unit_price)
  select anomaly_a_id, id, category, name, price
  from menu_items
  where (category = 'base' and name = 'Cheese Burst')
     or (category = 'pizza' and name = 'BBQ Chicken')
     or (category = 'topping' and name = 'Roasted Garlic');

  -- Anomaly B: correct discount logic (qty 1, no discount expected), but
  -- GST was never applied -- Stage 1's other named pain point ("manually
  -- adding 18% GST is easy to skip when rushed"). Triggers GST_MISMATCH.
  insert into orders (
    customer_name, phone, quantity, unit_total, subtotal, discount_rate,
    discount_amount, post_discount_total, gst_amount, grand_total,
    payment_mode, created_at
  ) values (
    'Test Anomaly Two', '9812345602', 1, 487.00, 487.00, 0.00,
    0.00, 487.00, 0.00, 487.00,
    'UPI', now() - interval '3 hours'
  ) returning id into anomaly_b_id;

  insert into order_items (order_id, menu_item_id, category, item_name, unit_price)
  select anomaly_b_id, id, category, name, price
  from menu_items
  where (category = 'base' and name = 'Thin Crust')
     or (category = 'pizza' and name = 'Margherita')
     or (category = 'topping' and name = 'Sweet Corn');
end $$;
