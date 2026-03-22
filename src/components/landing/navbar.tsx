"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { MagneticButton } from "./magnetic-button";

const navLinks = [
  { href: "#ozellikler", label: "Özellikler" },
  { href: "#nasil-calisir", label: "Nasıl Çalışır" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/60 backdrop-blur-2xl border-b border-border/50 shadow-[0_4px_30px_-10px_oklch(0_0_0/0.3)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <MagneticButton key={link.href} strength={0.2}>
              <a
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group py-2"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-px bg-ai-primary transition-all duration-300 group-hover:w-full" />
              </a>
            </MagneticButton>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <MagneticButton strength={0.15}>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Giriş Yap
            </Link>
          </MagneticButton>
          <MagneticButton strength={0.2}>
            <Link
              href="/login"
              className="group relative inline-flex items-center justify-center rounded-lg bg-ai-primary text-white text-sm font-medium px-5 py-2.5 transition-all duration-300 hover:shadow-[0_0_20px_-3px_oklch(0.673_0.182_276.935/0.4)] overflow-hidden"
            >
              <span className="relative z-10">Hemen Başla</span>
              <div className="absolute inset-0 bg-gradient-to-r from-ai-primary to-ai-premium opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
          </MagneticButton>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    {link.label}
                  </a>
                ))}
                <hr className="border-border/30" />
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-ai-primary hover:bg-ai-primary/90 text-white text-sm font-medium px-4 py-2 transition-colors w-full"
                >
                  Hemen Başla
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.nav>
  );
}
