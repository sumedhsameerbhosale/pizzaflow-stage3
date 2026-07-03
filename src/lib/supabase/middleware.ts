import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Shared by src/proxy.ts (Next.js 16 renamed `middleware` to `proxy`).
 * Refreshes the Supabase session on every /admin/* request and gates
 * access: unauthenticated visitors to /admin/* (other than the login
 * page) are redirected to /admin/login; already-authenticated visitors
 * to /admin/login are redirected straight to /admin/orders.
 *
 * This is an *optimistic* check (per Next.js's own auth guidance) --
 * the real authorization boundary is Postgres RLS (orders/order_items
 * SELECT is `to authenticated` only), so even if this redirect were
 * ever bypassed, no data could actually be read.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) -- contacts the Auth server to verify
  // the token, safe to use for an authorization decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginRoute = pathname === "/admin/login";

  if (!isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/orders";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
