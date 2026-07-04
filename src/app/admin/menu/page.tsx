import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/AdminNav";
import MenuManager from "@/components/admin/MenuManager";
import type { MenuItem } from "@/lib/types";

export default async function AdminMenuPage() {
  const supabase = await createClient();
  const { data: menuItems, error } = await supabase
    .from("menu_items")
    .select("id, category, name, price, is_active")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  return (
    <>
      <AdminNav active="menu" />
      <h1 className="mb-4 text-xl font-bold text-gray-900">Menu</h1>
      {error || !menuItems ? (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Could not load menu items. Please refresh and try again.
        </p>
      ) : (
        <MenuManager initialItems={menuItems as MenuItem[]} />
      )}
    </>
  );
}
