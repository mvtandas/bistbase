"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";

export function EmailCta() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/onboarding",
      });
      if (result?.ok) {
        router.push("/login?verify=1");
      }
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-md mx-auto"
    >
      <Input
        type="email"
        placeholder="E-posta adresiniz"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 bg-secondary border-border/50 text-foreground placeholder:text-muted-foreground"
        required
      />
      <Button
        type="submit"
        disabled={loading}
        className="h-12 px-6 bg-ai-primary hover:bg-ai-primary/90 text-white font-medium"
      >
        {loading ? "Gönderiliyor..." : "Hemen Başla"}
        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </form>
  );
}
