"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PremiumUpsellModalProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumUpsellModal({ open, onClose }: PremiumUpsellModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-ai-premium/20">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ai-premium/10">
            <Crown className="h-7 w-7 text-ai-premium" />
          </div>
          <DialogTitle className="text-xl text-center">
            Premium&apos;a Geç
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Ücretsiz planda maksimum 2 hisse takip edebilirsiniz. Sınırsız
            hisse takibi için Premium&apos;a yükseltin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-ai-premium shrink-0" />
            <span>Sınırsız hisse takibi</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-ai-premium shrink-0" />
            <span>Öncelikli AI analiz</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-ai-premium shrink-0" />
            <span>Detaylı teknik göstergeler</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <Link
            href="/dashboard/upgrade"
            className={cn(
              buttonVariants(),
              "w-full bg-ai-premium hover:bg-ai-premium/90 text-white"
            )}
          >
            Premium&apos;a Yükselt
          </Link>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Şimdilik Değil
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
