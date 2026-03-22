"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Check, Loader2 } from "lucide-react";

export function EmailCta() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/login?verify=1&email=${encodeURIComponent(normalizedEmail)}`);
        }, 600);
      } else {
        const data = await res.json();
        setError(data.error || "Bir hata oluştu. Tekrar deneyin.");
      }
    } catch {
      setError("Bir hata oluştu. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 w-full"
    >
      <div className="relative flex-1">
        <Input
          type="email"
          placeholder="E-posta adresiniz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 bg-secondary/50 border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:border-ai-primary/50 transition-all duration-300 focus:shadow-[0_0_20px_-5px_oklch(0.673_0.182_276.935/0.15)]"
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading || success}
        className="group relative h-12 px-6 bg-ai-primary text-white font-medium shrink-0 overflow-hidden transition-all duration-300 hover:shadow-[0_0_25px_-3px_oklch(0.673_0.182_276.935/0.4)]"
      >
        {/* Gradient hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-ai-primary to-ai-premium opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <span className="relative z-10 flex items-center gap-2">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.span
                key="success"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Gönderildi
              </motion.span>
            ) : loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Gönderiliyor
              </motion.span>
            ) : (
              <motion.span
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                Hemen Başla
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </Button>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-destructive mt-1 sm:absolute sm:-bottom-6 sm:left-0"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
