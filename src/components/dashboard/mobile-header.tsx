"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/shared/logo";
import { Sidebar } from "./sidebar";
import { Menu } from "lucide-react";

interface MobileHeaderProps {
  userEmail: string;
  userPlan: string;
  portfolioStocks: string[];
}

export function MobileHeader({
  userEmail,
  userPlan,
  portfolioStocks,
}: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 md:hidden">
      <Logo />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <Sidebar
            userEmail={userEmail}
            userPlan={userPlan}
            portfolioStocks={portfolioStocks}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
