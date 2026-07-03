"use client";

import { useState } from "react";
import type { AnomalyFlag } from "@/lib/anomaly";

type Props = {
  orderId: string;
  flags: AnomalyFlag[];
  quantity: number;
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  grandTotal: number;
};

/**
 * The badge itself is 100% derived from lib/anomaly.ts (deterministic,
 * already computed server-side before this renders) -- it never depends
 * on the LLM being reachable. Clicking it optionally fetches a plain-
 * English explanation from OpenRouter; if that call fails, it falls
 * back to the flags' own rule-based messages.
 */
export default function AnomalyBadge({
  orderId,
  flags,
  quantity,
  subtotal,
  discountAmount,
  gstAmount,
  grandTotal,
}: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  if (flags.length === 0) return null;

  async function handleClick() {
    setOpen((prev) => !prev);
    if (explanation || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/anomaly-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          quantity,
          subtotal,
          discountAmount,
          gstAmount,
          grandTotal,
          flags,
        }),
      });
      const data = await res.json();
      setExplanation(data.explanation);
    } catch {
      setExplanation(flags.map((f) => f.message).join(" "));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 hover:bg-red-200"
        title="Click for details"
      >
        {flags.length} anomaly{flags.length > 1 ? "ies" : ""}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-72 rounded-md border bg-white p-3 text-xs text-gray-700 shadow-lg">
          {loading ? (
            "Loading explanation..."
          ) : (
            <p>{explanation ?? flags.map((f) => f.message).join(" ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
