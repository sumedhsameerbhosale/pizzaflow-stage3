import type { SupabaseClient } from "@supabase/supabase-js";
import { DISCOUNT_QTY_THRESHOLD } from "./billing";

/**
 * Reads the live discount quantity threshold from app_settings.
 * Falls back to the hardcoded default on any failure (missing row,
 * network error, RLS issue) -- a config read must never block
 * checkout, same non-blocking philosophy as the AI features.
 */
export async function getDiscountQtyThreshold(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("discount_qty_threshold")
    .eq("id", true)
    .single();

  if (error || !data) {
    return DISCOUNT_QTY_THRESHOLD;
  }

  return data.discount_qty_threshold;
}
