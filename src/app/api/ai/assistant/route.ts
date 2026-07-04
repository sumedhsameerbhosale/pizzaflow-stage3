import { NextResponse } from "next/server";
import { callOpenRouter, type OpenRouterMessage } from "@/lib/openrouter";
import {
  validateName,
  validatePhone,
  validateQuantity,
  validatePaymentMode,
} from "@/lib/validators";
import type { MenuItem, ExtractedOrderFields } from "@/lib/types";

/**
 * Smart Order Assistant (AI feature 1, from Stage 1 Opportunity 1).
 * Non-blocking: the order form works fully without this endpoint ever
 * succeeding. Always returns HTTP 200 with a `source` tag so the panel
 * can render a normal-looking reply even when OpenRouter is down.
 */

const FALLBACK_REPLY =
  "The order assistant is temporarily unavailable. You can continue building the order manually below -- nothing is blocked.";

function buildSystemPrompt(menu: {
  bases: MenuItem[];
  pizzas: MenuItem[];
  toppings: MenuItem[];
}): string {
  const list = (items: MenuItem[]) =>
    items.map((i) => `${i.name} (Rs. ${i.price})`).join(", ");

  return `You are the PizzaFlow Smart Order Assistant, helping counter staff build a customer's pizza order quickly and correctly at SliceMatic.

Current menu:
- Bases: ${list(menu.bases)}
- Pizzas: ${list(menu.pizzas)}
- Toppings: ${list(menu.toppings)}

Your job:
1. Answer menu questions in plain language (e.g. "what's a good vegetarian option with a spicy kick?").
2. Help staff pick a base, pizza, and topping combination based on the customer's stated preference.
3. Flag likely order-entry mistakes before they are submitted -- for example, if the conversation suggests the customer wants two separate pizzas but only one quantity/topping combination has been described, say so explicitly.

Rules:
- You do not have the authority to place, modify, or cancel orders. You only advise -- the human operator enters the final order into the form.
- Never invent menu items, prices, or discounts that are not in the menu data given above.
- Keep responses short (2-4 sentences) -- this is a live counter interaction, not a long chat.
- If asked about anything unrelated to PizzaFlow's menu or ordering process, politely redirect to menu/order topics.

Additionally, on every reply, output a single JSON object with exactly these keys:
- "reply": your normal conversational response as a string (same 2-4 sentence rule as above).
- "extractedOrder": OPTIONAL. Include this key only if the conversation gives you clear, explicit information about the order. It may contain any of these sub-keys, each OPTIONAL -- omit any field that is unclear, ambiguous, or not mentioned. Never guess or default a value.
  - "customerName": string
  - "phone": string
  - "baseName": EXACT name from the Bases list above, never invented
  - "pizzaName": EXACT name from the Pizzas list above, never invented
  - "toppingName": EXACT name from the Toppings list above, never invented
  - "quantity": number
  - "paymentMode": one of "Cash", "Card", "UPI"

If nothing about the order is clear yet, omit "extractedOrder" entirely. Respond with ONLY this JSON object, no other text.`;
}

type RawExtractedOrder = {
  customerName?: unknown;
  phone?: unknown;
  baseName?: unknown;
  pizzaName?: unknown;
  toppingName?: unknown;
  quantity?: unknown;
  paymentMode?: unknown;
};

function findByName(items: MenuItem[], name: string): MenuItem | undefined {
  const lower = name.trim().toLowerCase();
  return items.find((i) => i.name.trim().toLowerCase() === lower);
}

/**
 * Never trusts the model's raw output directly: base/pizza/topping
 * names are resolved to real ids only via exact (case-insensitive)
 * match against the actual menu passed in, and customerName/phone/
 * quantity/paymentMode are re-run through the same validators used at
 * final order submission. Anything that doesn't resolve or validate is
 * dropped silently -- a field either arrives pre-validated-correct or
 * doesn't arrive at all, matching this app's "never trust the AI for
 * anything that affects correctness" principle.
 */
function resolveExtractedOrder(
  raw: RawExtractedOrder | undefined,
  menu: { bases: MenuItem[]; pizzas: MenuItem[]; toppings: MenuItem[] }
): ExtractedOrderFields | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const result: ExtractedOrderFields = {};

  if (typeof raw.customerName === "string") {
    const r = validateName(raw.customerName);
    if (r.ok) result.customerName = r.value;
  }
  if (typeof raw.phone === "string") {
    const r = validatePhone(raw.phone);
    if (r.ok) result.phone = r.value;
  }
  if (typeof raw.baseName === "string") {
    const item = findByName(menu.bases, raw.baseName);
    if (item) result.baseId = item.id;
  }
  if (typeof raw.pizzaName === "string") {
    const item = findByName(menu.pizzas, raw.pizzaName);
    if (item) result.pizzaId = item.id;
  }
  if (typeof raw.toppingName === "string") {
    const item = findByName(menu.toppings, raw.toppingName);
    if (item) result.toppingId = item.id;
  }
  if (raw.quantity !== undefined && raw.quantity !== null) {
    const r = validateQuantity(String(raw.quantity));
    if (r.ok) result.quantity = r.value;
  }
  if (typeof raw.paymentMode === "string") {
    const r = validatePaymentMode(raw.paymentMode);
    if (r.ok) result.paymentMode = r.value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function POST(request: Request) {
  let body: {
    messages?: { role: "user" | "assistant"; content: string }[];
    menu?: { bases: MenuItem[]; pizzas: MenuItem[]; toppings: MenuItem[] };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  if (!body.menu || !body.messages) {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  const messages: OpenRouterMessage[] = [
    { role: "system", content: buildSystemPrompt(body.menu) },
    ...body.messages,
  ];

  const result = await callOpenRouter(messages, { jsonMode: true });

  if (!result.ok) {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  let parsed: { reply?: unknown; extractedOrder?: RawExtractedOrder };
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  const extractedOrder = resolveExtractedOrder(parsed.extractedOrder, body.menu);

  return NextResponse.json({
    reply: parsed.reply,
    source: "ai",
    ...(extractedOrder ? { extractedOrder } : {}),
  });
}
