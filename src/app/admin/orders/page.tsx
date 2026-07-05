import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
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
      <h1 className="mb-4 text-xl font-bold text-foreground">All Orders</h1>
      {error ? (
        <p className="text-destructive">Could not load orders: {error.message}</p>
      ) : (
        <OrdersTable
          orders={(orders ?? []) as OrderWithItems[]}
          discountQtyThreshold={discountQtyThreshold}
        />
      )}
    </>
  );
}
