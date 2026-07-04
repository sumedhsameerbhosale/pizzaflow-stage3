"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { AnomalyFlag } from "@/lib/anomaly";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
        title="Click for details"
        className={cn(badgeVariants({ variant: "destructive" }), "cursor-pointer")}
      >
        <TriangleAlert />
        {flags.length} anomal{flags.length > 1 ? "ies" : "y"}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-72 rounded-md border bg-card p-3 text-xs text-card-foreground shadow-lg">
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
