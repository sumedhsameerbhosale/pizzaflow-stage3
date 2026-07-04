import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
import AdminNav from "@/components/admin/AdminNav";
import OrdersTable from "@/components/admin/OrdersTable";
import type { OrderWithItems } from "@/lib/types";

// proxy.ts already redirects unauthenticated visitors to /login before
// this page renders; RLS (orders/order_items SELECT `to authenticated`)
// is the real security boundary either way.
export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const [{ data: orders, error }, discountQtyThreshold] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false }),
    getDiscountQtyThreshold(supabase),
  ]);

  return (
    <>
      <AdminNav active="orders" />
      <h1 className="mb-4 text-xl font-bold text-gray-900">All Orders</h1>
      {error ? (
        <p className="text-red-600">Could not load orders: {error.message}</p>
      ) : (
        <OrdersTable
          orders={(orders ?? []) as OrderWithItems[]}
          discountQtyThreshold={discountQtyThreshold}
        />
      )}
    </>
  );
}
