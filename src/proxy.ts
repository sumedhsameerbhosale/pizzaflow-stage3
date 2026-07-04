import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed `middleware.ts`/`export function middleware` to
// `proxy.ts`/`export function proxy` -- functionality is unchanged.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
