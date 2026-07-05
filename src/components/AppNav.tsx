"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  BarChart3,
  Pizza,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

type NavLink = { key: string; href: string; label: string; icon: LucideIcon };

const ADMIN_TABS: NavLink[] = [
  { key: "orders", href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { key: "insights", href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { key: "menu", href: "/admin/menu", label: "Menu", icon: Pizza },
  { key: "settings", href: "/admin/settings", label: "Settings", icon: Settings },
];

const TAKE_ORDERS_LINK: NavLink = {
  key: "take-orders",
  href: "/",
  label: "Take Orders",
  icon: UtensilsCrossed,
};

const ADMIN_DASHBOARD_LINK: NavLink = {
  key: "admin-dashboard",
  href: "/admin/orders",
  label: "Admin dashboard",
  icon: LayoutDashboard,
};

export default function AppNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdminSection = pathname.startsWith("/admin");

  const links: NavLink[] = [
    TAKE_ORDERS_LINK,
    ...(role === "admin" ? (isAdminSection ? ADMIN_TABS : [ADMIN_DASHBOARD_LINK]) : []),
  ];

  function renderLink(link: NavLink, { onClick, className }: { onClick?: () => void; className?: string }) {
    const Icon = link.icon;
    const isConvenienceLink = link.key === "admin-dashboard";
    const isActive = pathname === link.href;
    return (
      <Link
        key={link.key}
        href={link.href}
        onClick={onClick}
        className={cn(
          buttonVariants({
            variant: isConvenienceLink ? "outline" : isActive ? "default" : "ghost",
            size: "sm",
          }),
          className
        )}
      >
        <Icon />
        {link.label}
      </Link>
    );
  }

  return (
    <nav className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-7 w-7" />
          <span className="text-lg font-bold text-foreground">PizzaFlow</span>
        </Link>

        <div className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map((link) => renderLink(link, {}))}
        </div>

        <div className="hidden lg:block">
          <LogoutButton />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LogoutButton />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {links.map((link) =>
                  renderLink(link, {
                    onClick: () => setOpen(false),
                    className: "justify-start",
                  })
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
