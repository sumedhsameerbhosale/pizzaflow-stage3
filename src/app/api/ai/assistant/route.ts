import { NextResponse } from "next/server";
import { callOpenRouter, type OpenRouterMessage } from "@/lib/openrouter";
import type { MenuItem } from "@/lib/types";

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
- If asked about anything unrelated to PizzaFlow's menu or ordering process, politely redirect to menu/order topics.`;
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

  const result = await callOpenRouter(messages);

  if (!result.ok) {
    return NextResponse.json({ reply: FALLBACK_REPLY, source: "fallback" });
  }

  return NextResponse.json({ reply: result.text, source: "ai" });
}
