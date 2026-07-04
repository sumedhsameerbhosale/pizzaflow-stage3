import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateMenuItemName, validateMenuItemPrice } from "@/lib/validators";
import type { MenuCategory } from "@/lib/types";

const CATEGORIES: MenuCategory[] = ["base", "pizza", "topping"];

/**
 * POST creates a menu item, PATCH updates name/price/is_active by id.
 * Both rely on RLS (`menu_items_admin_insert`, `menu_items_admin_update`,
 * see supabase/add_menu_admin_write.sql) as the real security boundary --
 * /admin/menu itself is additionally gated by proxy.ts, same
 * defense-in-depth pattern as every other admin write in this app.
 * No DELETE handler -- items are soft-deactivated via is_active, never
 * hard-deleted.
 */
export async function POST(request: Request) {
  const body: { category?: string; name?: string; price?: string | number } =
    await request.json().catch(() => ({}));

  if (!body.category || !CATEGORIES.includes(body.category as MenuCategory)) {
    return NextResponse.json(
      { ok: false, field: "category", error: "Please choose base, pizza, or topping." },
      { status: 400 }
    );
  }

  const nameResult = validateMenuItemName(body.name ?? "");
  if (!nameResult.ok) {
    return NextResponse.json(
      { ok: false, field: "name", error: nameResult.error },
      { status: 400 }
    );
  }

  const priceResult = validateMenuItemPrice(String(body.price ?? ""));
  if (!priceResult.ok) {
    return NextResponse.json(
      { ok: false, field: "price", error: priceResult.error },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      category: body.category,
      name: nameResult.value,
      price: priceResult.value,
    })
    .select("id, category, name, price, is_active")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Could not create the item. Please make sure you're logged in as an admin." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const body: {
    id?: string;
    name?: string;
    price?: string | number;
    is_active?: boolean;
  } = await request.json().catch(() => ({}));

  if (!body.id) {
    return NextResponse.json(
      { ok: false, error: "Missing item id." },
      { status: 400 }
    );
  }

  const update: { name?: string; price?: number; is_active?: boolean } = {};

  if (body.name !== undefined) {
    const nameResult = validateMenuItemName(body.name);
    if (!nameResult.ok) {
      return NextResponse.json(
        { ok: false, field: "name", error: nameResult.error },
        { status: 400 }
      );
    }
    update.name = nameResult.value;
  }

  if (body.price !== undefined) {
    const priceResult = validateMenuItemPrice(String(body.price));
    if (!priceResult.ok) {
      return NextResponse.json(
        { ok: false, field: "price", error: priceResult.error },
        { status: 400 }
      );
    }
    update.price = priceResult.value;
  }

  if (body.is_active !== undefined) {
    update.is_active = body.is_active;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No fields to update." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .update(update)
    .eq("id", body.id)
    .select("id, category, name, price, is_active")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Could not update the item. Please make sure you're logged in as an admin." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, item: data });
}
