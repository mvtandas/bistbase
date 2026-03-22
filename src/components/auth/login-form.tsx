"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowRight, ShieldCheck, ArrowLeft } from "lucide-react";

export function LoginForm({ isVerify }: { isVerify: boolean }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp">(isVerify ? "otp" : "email");
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/onboarding",
      });
      if (result?.error) {
        setError("E-posta gönderilemedi. Tekrar deneyin.");
      } else {
        setStep("otp");
      }
    } catch {
      setError("Bir hata oluştu. Tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    // NextAuth email callback — tarayıcı doğrudan yönlendirilmeli (cookie'ler için)
    const params = new URLSearchParams({
      callbackUrl: "/onboarding",
      token: code,
      email,
    });
    window.location.href = `/api/auth/callback/email?${params.toString()}`;
  }

  if (step === "otp") {
    return (
      <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ai-primary/10">
            <ShieldCheck className="h-6 w-6 text-ai-primary" />
          </div>
          <CardTitle className="text-xl">Doğrulama Kodu</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-foreground/80 font-medium">{email}</span> adresine 6 haneli kod gönderdik.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-mono font-bold bg-secondary border border-border/50 rounded-lg text-foreground outline-none focus:border-ai-primary focus:ring-1 focus:ring-ai-primary/50 transition-colors"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full h-12 bg-ai-primary hover:bg-ai-primary/90 text-white"
            >
              {loading ? "Doğrulanıyor..." : "Giriş Yap"}
            </Button>

            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
              className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Farklı e-posta kullan
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto border-border/50 bg-card/50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ai-primary/10">
          <Mail className="h-6 w-6 text-ai-primary" />
        </div>
        <CardTitle className="text-xl">Giriş Yap</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          E-posta adresinize bir doğrulama kodu göndereceğiz.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="E-posta adresiniz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-secondary border-border/50"
            required
          />

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-ai-primary hover:bg-ai-primary/90 text-white"
          >
            {loading ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
