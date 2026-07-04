import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getUserRole } from "@/lib/auth";

/**
 * Shared by src/proxy.ts (Next.js 16 renamed `middleware` to `proxy`).
 * Refreshes the Supabase session on every gated request (`/` and
 * `/admin/*`) and gates access:
 *   - Unauthenticated visitors to a gated path (other than /login
 *     itself) are redirected to /login?next=<original path>.
 *   - Authenticated non-admin ("staff") visitors to /admin/* are
 *     redirected to `/` -- staff can take orders but not see order
 *     history, insights, or settings.
 *   - Already-authenticated visitors to /login are redirected to
 *     `next` (if their role allows it) or a role-appropriate default
 *     (/admin/orders for admins, `/` for staff).
 *
 * This is an *optimistic* check (per Next.js's own auth guidance) --
 * the real authorization boundary is Postgres RLS (orders/order_items
 * INSERT is `to authenticated`, SELECT and app_settings UPDATE require
 * the "admin" role via the JWT's app_metadata -- see
 * supabase/add_roles.sql), so even if this redirect were ever
 * bypassed, no data could actually be read or written by the wrong role.
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
  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname.startsWith("/admin");
  const role = getUserRole(user);

  if (!isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user && isAdminRoute && role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const next = request.nextUrl.searchParams.get("next");
    const nextAllowed =
      !!next && next.startsWith("/") && (role === "admin" || !next.startsWith("/admin"));
    const url = request.nextUrl.clone();
    url.pathname = nextAllowed ? next! : role === "admin" ? "/admin/orders" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
