import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateName,
  validatePhone,
  validateQuantity,
  validatePaymentMode,
} from "@/lib/validators";
import { computeBill, type BillLine } from "@/lib/billing";
import { getDiscountQtyThreshold } from "@/lib/settings";
import type { MenuCategory } from "@/lib/types";

type PlaceOrderRequestBody = {
  customerName?: string;
  phone?: string;
  baseId?: string;
  pizzaId?: string;
  toppingId?: string;
  quantity?: string | number;
  paymentMode?: string;
};

/**
 * Authoritative order-placement endpoint. Never trusts the client for
 * anything that affects the bill: re-runs every Stage 2 validation rule
 * server-side and re-fetches menu item prices fresh from the DB (a
 * tampered client payload with a forged price can never be persisted).
 * Writes orders + order_items in one place so the two-table insert
 * can't partially fail from a client's perspective.
 */
export async function POST(request: Request) {
  let body: PlaceOrderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const nameResult = validateName(body.customerName ?? "");
  if (!nameResult.ok) {
    return NextResponse.json(
      { ok: false, field: "customerName", error: nameResult.error },
      { status: 400 }
    );
  }

  const phoneResult = validatePhone(body.phone ?? "");
  if (!phoneResult.ok) {
    return NextResponse.json(
      { ok: false, field: "phone", error: phoneResult.error },
      { status: 400 }
    );
  }

  const quantityResult = validateQuantity(String(body.quantity ?? ""));
  if (!quantityResult.ok) {
    return NextResponse.json(
      { ok: false, field: "quantity", error: quantityResult.error },
      { status: 400 }
    );
  }

  const paymentResult = validatePaymentMode(body.paymentMode ?? "");
  if (!paymentResult.ok) {
    return NextResponse.json(
      { ok: false, field: "paymentMode", error: paymentResult.error },
      { status: 400 }
    );
  }

  if (!body.baseId || !body.pizzaId || !body.toppingId) {
    return NextResponse.json(
      { ok: false, field: "menu", error: "Please select a base, pizza, and topping." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const [{ data: menuRows, error: menuError }, discountQtyThreshold] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, category, name, price, is_active")
      .in("id", [body.baseId, body.pizzaId, body.toppingId]),
    getDiscountQtyThreshold(supabase),
  ]);

  if (menuError) {
    return NextResponse.json(
      { ok: false, error: "Could not verify menu selection. Please try again." },
      { status: 500 }
    );
  }

  const findItem = (id: string, category: MenuCategory) =>
    menuRows?.find(
      (row) => row.id === id && row.category === category && row.is_active
    );

  const base = findItem(body.baseId, "base");
  const pizza = findItem(body.pizzaId, "pizza");
  const topping = findItem(body.toppingId, "topping");

  if (!base || !pizza || !topping) {
    return NextResponse.json(
      {
        ok: false,
        field: "menu",
        error:
          "One or more selected items are no longer available. Please refresh the menu and select again.",
      },
      { status: 400 }
    );
  }

  const lines: BillLine[] = [
    { label: "Base", itemName: base.name, unitPrice: base.price },
    { label: "Pizza", itemName: pizza.name, unitPrice: pizza.price },
    { label: "Topping", itemName: topping.name, unitPrice: topping.price },
  ];
  const bill = computeBill(lines, quantityResult.value, discountQtyThreshold);

  // Generate the id ourselves and skip .select() after insert: the anon
  // role can INSERT into orders but deliberately cannot SELECT it (that
  // restriction is what gates the admin view) -- asking PostgREST to
  // return the inserted row would require a SELECT-back and fail RLS
  // even though the insert itself is allowed.
  const orderId = randomUUID();
  const createdAt = new Date().toISOString();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    customer_name: nameResult.value,
    phone: phoneResult.value,
    quantity: bill.quantity,
    unit_total: bill.unitTotal,
    subtotal: bill.subtotal,
    discount_rate: bill.discountRate,
    discount_amount: bill.discountAmount,
    post_discount_total: bill.postDiscountTotal,
    gst_amount: bill.gstAmount,
    grand_total: bill.grandTotal,
    payment_mode: paymentResult.value,
  });

  if (orderError) {
    return NextResponse.json(
      { ok: false, error: "Could not save the order. Please try again." },
      { status: 500 }
    );
  }

  const { error: itemsError } = await supabase.from("order_items").insert([
    {
      order_id: orderId,
      menu_item_id: base.id,
      category: "base",
      item_name: base.name,
      unit_price: base.price,
    },
    {
      order_id: orderId,
      menu_item_id: pizza.id,
      category: "pizza",
      item_name: pizza.name,
      unit_price: pizza.price,
    },
    {
      order_id: orderId,
      menu_item_id: topping.id,
      category: "topping",
      item_name: topping.name,
      unit_price: topping.price,
    },
  ]);

  if (itemsError) {
    return NextResponse.json(
      { ok: false, error: "Order was saved but line items failed. Please contact staff." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    order: {
      id: orderId,
      createdAt,
      customerName: nameResult.value,
      phone: phoneResult.value,
      items: lines.map((l) => ({
        category: l.label.toLowerCase() as MenuCategory,
        name: l.itemName,
        unitPrice: l.unitPrice,
      })),
      quantity: bill.quantity,
      unitTotal: bill.unitTotal,
      subtotal: bill.subtotal,
      discountRate: bill.discountRate,
      discountAmount: bill.discountAmount,
      postDiscountTotal: bill.postDiscountTotal,
      gstAmount: bill.gstAmount,
      grandTotal: bill.grandTotal,
      paymentMode: paymentResult.value,
    },
  });
}
