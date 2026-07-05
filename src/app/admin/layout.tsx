import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import AppNav from "@/components/AppNav";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const role = getUserRole(userData.user);

  return (
    <>
      <AppNav role={role} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </>
  );
}
