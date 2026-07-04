"use client";

import Link from "next/link";
import {
  UtensilsCrossed,
  ClipboardList,
  BarChart3,
  Pizza,
  Settings,
} from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "orders" | "insights" | "menu" | "settings";

const TABS: { key: Tab; href: string; label: string; icon: typeof Pizza }[] = [
  { key: "orders", href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { key: "insights", href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { key: "menu", href: "/admin/menu", label: "Menu", icon: Pizza },
  { key: "settings", href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminNav({ active }: { active: Tab }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-y-3 border-b pb-4">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <div className="mr-2 flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="text-lg font-bold text-foreground">PizzaFlow Admin</span>
        </div>
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <UtensilsCrossed />
          Take Orders
        </Link>
        {TABS.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              buttonVariants({
                variant: active === key ? "default" : "ghost",
                size: "sm",
              })
            )}
          >
            <Icon />
            {label}
          </Link>
        ))}
      </div>
      <LogoutButton />
    </nav>
  );
}
