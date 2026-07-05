import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
import { getUserRole } from "@/lib/auth";
import OrderForm from "@/components/order/OrderForm";
import AppNav from "@/components/AppNav";
import type { MenuItem } from "@/lib/types";

// proxy.ts already redirects unauthenticated visitors to /login before
// this page renders, and redirects staff away from /admin/*; RLS
// (orders/order_items INSERT `to authenticated`) is the real security
// boundary either way.
export default async function Home() {
  const supabase = await createClient();
  const [{ data: menuItems, error }, discountQtyThreshold, { data: userData }] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select("id, category, name, price, is_active")
        .eq("is_active", true)
        .order("price", { ascending: true }),
      getDiscountQtyThreshold(supabase),
      supabase.auth.getUser(),
    ]);
  const role = getUserRole(userData.user);

  if (error || !menuItems) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-destructive">
          PizzaFlow is temporarily unavailable
        </h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load the menu right now. Please tell a staff
          member and try again shortly.
        </p>
      </main>
    );
  }

  const typedMenuItems = menuItems as MenuItem[];
  const bases = typedMenuItems.filter((m) => m.category === "base");
  const pizzas = typedMenuItems.filter((m) => m.category === "pizza");
  const toppings = typedMenuItems.filter((m) => m.category === "topping");

  return (
    <>
      <AppNav role={role} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-foreground">PizzaFlow</h1>
          <p className="mt-1 text-muted-foreground">
            SliceMatic&apos;s digital ordering counter
          </p>
        </header>
        <OrderForm
          bases={bases}
          pizzas={pizzas}
          toppings={toppings}
          discountQtyThreshold={discountQtyThreshold}
        />
      </main>
    </>
  );
}
