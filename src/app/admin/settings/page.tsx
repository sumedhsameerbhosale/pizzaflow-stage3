import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
import AdminNav from "@/components/admin/AdminNav";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const discountQtyThreshold = await getDiscountQtyThreshold(supabase);

  return (
    <>
      <AdminNav active="settings" />
      <h1 className="mb-4 text-xl font-bold text-gray-900">Settings</h1>
      <SettingsForm initialThreshold={discountQtyThreshold} />
    </>
  );
}
