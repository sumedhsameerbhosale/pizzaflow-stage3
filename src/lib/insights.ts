import { callOpenRouter } from "./openrouter";
import type { OrderWithItems } from "./types";

export type InsightStats = {
  totalOrders: number;
  bestSeller: { name: string; count: number } | null;
  peakHour: { dayLabel: string; hourLabel: string; count: number } | null;
  totalDiscountGiven: number;
  discountedOrderCount: number;
};

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Aggregate stats computed application-side over the already-fetched
 * order history (dataset size for this project is small enough that a
 * dedicated SQL view/RPC would be over-engineering). Always correct and
 * always available -- the LLM narration in narrateInsights() below is
 * additive only, never a dependency for these numbers to exist.
 */
export function computeInsightStats(orders: OrderWithItems[]): InsightStats {
  const pizzaCounts = new Map<string, number>();
  const hourBucketCounts = new Map<string, number>();
  let totalDiscountGiven = 0;
  let discountedOrderCount = 0;

  for (const order of orders) {
    for (const item of order.order_items) {
      if (item.category === "pizza") {
        pizzaCounts.set(item.item_name, (pizzaCounts.get(item.item_name) ?? 0) + 1);
      }
    }

    const d = new Date(order.created_at);
    const key = `${d.getDay()}-${d.getHours()}`;
    hourBucketCounts.set(key, (hourBucketCounts.get(key) ?? 0) + 1);

    totalDiscountGiven += order.discount_amount;
    if (order.discount_amount > 0) discountedOrderCount++;
  }

  let bestSeller: InsightStats["bestSeller"] = null;
  for (const [name, count] of pizzaCounts) {
    if (!bestSeller || count > bestSeller.count) bestSeller = { name, count };
  }

  let peakHour: InsightStats["peakHour"] = null;
  let peakCount = 0;
  for (const [key, count] of hourBucketCounts) {
    if (count > peakCount) {
      peakCount = count;
      const [day, hour] = key.split("-").map(Number);
      peakHour = {
        dayLabel: DAY_LABELS[day],
        hourLabel: `${hour}:00-${hour + 1}:00`,
        count,
      };
    }
  }

  return {
    totalOrders: orders.length,
    bestSeller,
    peakHour,
    totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
    discountedOrderCount,
  };
}

const SYSTEM_PROMPT = `You are a business analyst assistant for a pizza restaurant owner named Rajan.

You will be given pre-computed, already-correct aggregate statistics from the restaurant's order database (best-selling pizza, peak order hour, discount cost analysis). Do not perform any calculation yourself and do not alter any numbers you are given -- restate them accurately in plain, friendly English a busy restaurant owner can read in 10 seconds. Highlight one clear, actionable takeaway if the data supports one. If the data looks sparse (e.g. very few orders), say so honestly rather than overstating a trend.`;

/**
 * Insights Dashboard (AI feature 3, from Stage 1 Opportunity 2) --
 * narration half only. Stats above are always shown regardless of
 * whether this succeeds.
 */
export async function narrateInsights(stats: InsightStats) {
  if (stats.totalOrders === 0) {
    return { ok: false as const, reason: "no_data" };
  }
  return callOpenRouter([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(stats) },
  ]);
}
