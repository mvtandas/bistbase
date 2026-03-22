"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Mail, ArrowRight, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginForm({ isVerify, prefillEmail = "" }: { isVerify: boolean; prefillEmail?: string }) {
  const [email, setEmail] = useState(prefillEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp">(isVerify ? "otp" : "email");
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && step === "otp") {
      handleOtpSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleEmailSubmit(e: React.FormEvent) {
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "E-posta gönderilemedi. Tekrar deneyin.");
      } else {
        setEmail(normalizedEmail);
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

  async function handleOtpSubmit() {
    const code = otp.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const result = await signIn("otp", {
        email: email.toLowerCase().trim(),
        code,
        redirect: false,
        callbackUrl: "/onboarding",
      });

      if (result?.error) {
        setError("Geçersiz veya süresi dolmuş kod. Tekrar deneyin.");
        setLoading(false);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        window.location.href = "/onboarding";
      }
    } catch {
      setError("Bir hata oluştu. Tekrar deneyin.");
      setLoading(false);
    }
  }

  // ─── OTP Step ───
  if (step === "otp") {
    return (
      <div className="relative group">
        {/* Glow border effect */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-ai-primary/20 via-ai-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-8 shadow-[0_0_60px_-15px] shadow-ai-primary/[0.08]">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-ai-primary/20 blur-xl animate-pulse" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ai-primary/20 to-ai-premium/10 border border-ai-primary/20">
                <ShieldCheck className="h-6 w-6 text-ai-primary" />
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold text-foreground">Doğrulama Kodu</h1>
            <p className="mt-2 text-sm text-muted-foreground/70">
              <span className="text-foreground/70 font-medium">{email}</span>
              <br />adresine 6 haneli kod gönderdik
            </p>
          </div>

          {/* OTP Inputs */}
          <form onSubmit={(e) => { e.preventDefault(); handleOtpSubmit(); }}>
            <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
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
                  className={cn(
                    "w-12 h-14 text-center text-xl font-mono font-bold rounded-xl outline-none transition-all duration-200",
                    "bg-background/50 border-2 text-foreground",
                    digit
                      ? "border-ai-primary/40 shadow-[0_0_12px_-3px] shadow-ai-primary/20"
                      : "border-border/30 hover:border-border/50",
                    "focus:border-ai-primary focus:shadow-[0_0_20px_-5px] focus:shadow-ai-primary/30",
                    "placeholder:text-muted-foreground/20",
                  )}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-loss/10 border border-loss/20 px-3 py-2 text-center">
                <p className="text-xs text-loss">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className={cn(
                "relative w-full h-12 rounded-xl font-medium text-sm transition-all duration-300 overflow-hidden",
                "bg-gradient-to-r from-ai-primary to-ai-primary/80 text-white",
                "hover:shadow-[0_0_30px_-5px] hover:shadow-ai-primary/40 hover:brightness-110",
                "disabled:opacity-40 disabled:hover:shadow-none disabled:hover:brightness-100",
                "active:scale-[0.98]",
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Doğrulanıyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Giriş Yap
                </span>
              )}
            </button>

            {/* Back */}
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setError(""); }}
              className="flex items-center justify-center gap-1.5 w-full mt-4 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Farklı e-posta kullan
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Email Step ───
  return (
    <div className="relative group">
      {/* Glow border effect */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-ai-primary/20 via-ai-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-8 shadow-[0_0_60px_-15px] shadow-ai-primary/[0.08]">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className={cn(
              "absolute inset-0 rounded-full blur-xl transition-all duration-500",
              emailFocused ? "bg-ai-primary/25 scale-125" : "bg-ai-primary/15"
            )} />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ai-primary/20 to-ai-premium/10 border border-ai-primary/20">
              <Mail className="h-6 w-6 text-ai-primary" />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground">Hoş Geldiniz</h1>
          <p className="mt-2 text-sm text-muted-foreground/60">
            E-posta adresinize bir doğrulama kodu göndereceğiz
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="email"
              placeholder="E-posta adresiniz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              className={cn(
                "w-full h-12 rounded-xl px-4 text-sm outline-none transition-all duration-300",
                "bg-background/50 border-2 text-foreground placeholder:text-muted-foreground/30",
                emailFocused
                  ? "border-ai-primary/50 shadow-[0_0_20px_-5px] shadow-ai-primary/20"
                  : "border-border/30 hover:border-border/50",
              )}
              required
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-loss/10 border border-loss/20 px-3 py-2 text-center">
              <p className="text-xs text-loss">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email}
            className={cn(
              "relative w-full h-12 rounded-xl font-medium text-sm transition-all duration-300 overflow-hidden",
              "bg-gradient-to-r from-ai-primary to-ai-primary/80 text-white",
              "hover:shadow-[0_0_30px_-5px] hover:shadow-ai-primary/40 hover:brightness-110",
              "disabled:opacity-40 disabled:hover:shadow-none disabled:hover:brightness-100",
              "active:scale-[0.98]",
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Gönderiliyor...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Doğrulama Kodu Gönder
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-border/20" />
          <span className="text-[10px] text-muted-foreground/30 uppercase tracking-widest">Güvenli Giriş</span>
          <div className="flex-1 h-px bg-border/20" />
        </div>

        {/* Trust badges */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            256-bit SSL
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Şifresiz Giriş
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Anlık Doğrulama
          </span>
        </div>
      </div>
    </div>
  );
}
