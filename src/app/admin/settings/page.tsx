import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const discountQtyThreshold = await getDiscountQtyThreshold(supabase);

  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-foreground">Settings</h1>
      <SettingsForm initialThreshold={discountQtyThreshold} />
    </>
  );
}
