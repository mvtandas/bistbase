"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Clock,
  Database,
  Settings,
  ArrowLeft,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/crons", label: "Cron İşlemleri", icon: Clock },
  { href: "/admin/data", label: "Veri Yönetimi", icon: Database },
  { href: "/admin/config", label: "Sistem Ayarları", icon: Settings },
];

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full w-72 border-r border-border/50 bg-sidebar p-4">
      <div className="mb-6">
        <Logo />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            Super Admin
          </span>
        </div>
        <p className="text-sm text-foreground truncate mt-1">{userEmail}</p>
      </div>

      <Separator className="mb-4" />

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
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
      </nav>

      <Separator className="mb-4" />

      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Panele Dön
      </Link>
    </aside>
  );
}
