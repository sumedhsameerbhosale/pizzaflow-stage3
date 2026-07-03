import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDiscountThreshold } from "@/lib/validators";

/**
 * GET/PATCH the live app_settings row. GET is intentionally readable
 * without auth (menu_items-style public read -- the order flow needs
 * this value too, see lib/settings.ts). PATCH relies on RLS
 * (`app_settings_authenticated_update`, `to authenticated`) as the real
 * security boundary -- the /admin/settings page itself is additionally
 * gated by proxy.ts, same defense-in-depth pattern as every other write
 * in this app.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("discount_qty_threshold, updated_at")
    .eq("id", true)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: "Could not load settings." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, settings: data });
}

export async function PATCH(request: Request) {
  const body: { discountQtyThreshold?: string | number } = await request
    .json()
    .catch(() => ({}));

  const result = validateDiscountThreshold(String(body.discountQtyThreshold ?? ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ discount_qty_threshold: result.value, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("discount_qty_threshold, updated_at")
    .single();

  if (error || !data) {
    // Most likely cause: no authenticated session, so the
    // `app_settings_authenticated_update` RLS policy denied the write.
    return NextResponse.json(
      { ok: false, error: "Could not update settings. Please make sure you're logged in." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, settings: data });
}
