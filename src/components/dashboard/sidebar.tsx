"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Compass,
  User,
  Crown,
  LogOut,
} from "lucide-react";

interface SidebarProps {
  userEmail: string;
  userPlan: string;
  portfolioStocks: string[];
}

const navItems = [
  { href: "/dashboard", label: "Portföyüm", icon: LayoutDashboard },
  { href: "/dashboard/explore", label: "Keşfet", icon: Compass },
  { href: "/dashboard/profile", label: "Profil", icon: User },
];

export function Sidebar({ userEmail, userPlan, portfolioStocks }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full w-72 border-r border-border/50 bg-sidebar p-4">
      {/* Logo */}
      <div className="mb-6">
        <Logo />
      </div>

      {/* User info */}
      <div className="mb-4">
        <p className="text-sm text-foreground truncate">{userEmail}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {userPlan === "PREMIUM" ? "Premium Plan" : "Ücretsiz Plan"}
        </p>
      </div>

      <Separator className="mb-4" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {/* Portfolio stock list */}
        {portfolioStocks.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Takip Edilen
            </p>
            {portfolioStocks.map((code) => (
              <Link
                key={code}
                href="/dashboard"
                className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ai-primary" />
                {code}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Upgrade CTA */}
      {userPlan === "FREE" && (
        <div className="mt-auto mb-3 p-3 rounded-lg bg-ai-premium/10 border border-ai-premium/20">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-ai-premium" />
            <span className="text-sm font-medium text-foreground">
              Pro&apos;ya Yükselt
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Sınırsız hisse takibi ve detaylı analiz.
          </p>
          <Link
            href="/dashboard/upgrade"
            className={cn(
              buttonVariants({ size: "sm" }),
              "w-full bg-ai-premium hover:bg-ai-premium/90 text-white"
            )}
          >
            Yükselt
          </Link>
        </div>
      )}

      {/* Sign out */}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Çıkış Yap
      </button>
    </aside>
  );
}
