import { NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";
import type { AnomalyFlag } from "@/lib/anomaly";

const SYSTEM_PROMPT = `You are an assistant that explains billing anomalies to a restaurant admin reviewing an order history table.

You will be given an order's quantity, subtotal, discount amount, GST amount, grand total, and a list of rule codes that a deterministic check has already flagged (e.g. DISCOUNT_MISMATCH). The rule check is authoritative and already correct -- your only job is to explain, in one or two plain-English sentences, what looks wrong and why a human should double check it. Do not recompute or second-guess the numbers. Do not suggest the flag might be a false positive.`;

/**
 * Anomaly Flagging (AI feature 2, from Stage 1 Opportunity 3) -- the
 * narration half only. The flags themselves are computed deterministically
 * in lib/anomaly.ts before this route is ever called; this endpoint just
 * turns already-correct rule codes into friendlier prose. Falls back to
 * the flags' own rule-based messages if OpenRouter is unavailable.
 */
export async function POST(request: Request) {
  const body: {
    quantity?: number;
    subtotal?: number;
    discountAmount?: number;
    gstAmount?: number;
    grandTotal?: number;
    flags?: AnomalyFlag[];
  } = await request.json().catch(() => ({}));

  const flags = body.flags ?? [];
  const fallbackExplanation =
    "(Automated explanation unavailable -- showing rule-based detail.) " +
    flags.map((f) => f.message).join(" ");

  if (flags.length === 0) {
    return NextResponse.json({ explanation: "No anomalies detected.", source: "rule" });
  }

  const result = await callOpenRouter([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        quantity: body.quantity,
        subtotal: body.subtotal,
        discountAmount: body.discountAmount,
        gstAmount: body.gstAmount,
        grandTotal: body.grandTotal,
        flags,
      }),
    },
  ]);

  if (!result.ok) {
    return NextResponse.json({ explanation: fallbackExplanation, source: "fallback" });
  }

  return NextResponse.json({ explanation: result.text, source: "ai" });
}
