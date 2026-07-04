import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDiscountQtyThreshold } from "@/lib/settings";
import { getUserRole } from "@/lib/auth";
import OrderForm from "@/components/order/OrderForm";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="relative mb-8 flex flex-col items-center text-center">
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {role === "admin" && (
            <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
              <LayoutDashboard />
              Admin dashboard
            </Link>
          )}
          <LogoutButton />
        </div>
        <Logo className="mb-2 h-10 w-10" />
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
  );
}
