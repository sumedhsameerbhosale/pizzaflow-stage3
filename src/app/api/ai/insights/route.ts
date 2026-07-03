import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeInsightStats, narrateInsights } from "@/lib/insights";
import type { OrderWithItems } from "@/lib/types";

/**
 * Standalone endpoint for the Insights Dashboard's stats + AI narration
 * (the admin page itself calls the same lib functions directly server-
 * side to avoid an unnecessary self-fetch round trip; this route exists
 * so the feature is independently callable/testable, per the plan).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Could not load orders." },
      { status: 500 }
    );
  }

  const stats = computeInsightStats((orders ?? []) as OrderWithItems[]);
  const narration = await narrateInsights(stats);

  return NextResponse.json({
    ok: true,
    stats,
    narration: narration.ok ? narration.text : null,
    source: narration.ok ? "ai" : "fallback",
  });
}
