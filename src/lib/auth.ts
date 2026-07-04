import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "staff";

// Role lives in Supabase Auth's app_metadata (set via
// `raw_app_meta_data` on auth.users -- see supabase/add_roles.sql).
// Unset/missing role defaults to "staff" (least privilege): only
// accounts explicitly promoted to "admin" get access to /admin/*.
export function getUserRole(user: User | null | undefined): Role {
  return user?.app_metadata?.role === "admin" ? "admin" : "staff";
}
