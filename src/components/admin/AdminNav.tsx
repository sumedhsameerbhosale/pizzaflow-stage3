"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";

export default function AdminNav({
  active,
}: {
  active: "orders" | "insights" | "settings";
}) {
  const linkClass = (name: "orders" | "insights" | "settings") =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active === name
        ? "bg-accent text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <nav className="mb-6 flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-2">
        <Logo className="h-6 w-6" />
        <span className="mr-2 text-lg font-bold text-gray-900">PizzaFlow Admin</span>
        <Link href="/admin/orders" className={linkClass("orders")}>
          Orders
        </Link>
        <Link href="/admin/insights" className={linkClass("insights")}>
          Insights
        </Link>
        <Link href="/admin/settings" className={linkClass("settings")}>
          Settings
        </Link>
      </div>
      <LogoutButton />
    </nav>
  );
}
