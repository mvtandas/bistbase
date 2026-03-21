"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowRight } from "lucide-react";

export function LoginForm({ isVerify }: { isVerify: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(isVerify);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/onboarding",
      });
      setSent(true);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ai-primary/10">
            <Mail className="h-6 w-6 text-ai-primary" />
          </div>
          <CardTitle className="text-xl">E-postanızı kontrol edin</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Giriş bağlantısı e-posta adresinize gönderildi. Lütfen gelen
            kutunuzu kontrol edin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Giriş Yap</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          E-posta adresinize bir giriş bağlantısı göndereceğiz.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="E-posta adresiniz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-secondary border-border/50"
            required
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-ai-primary hover:bg-ai-primary/90 text-white"
          >
            {loading ? "Gönderiliyor..." : "Giriş Bağlantısı Gönder"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
