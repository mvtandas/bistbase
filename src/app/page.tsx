import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { HeroSection } from "@/components/landing/hero-section";
import { EmailCta } from "@/components/landing/email-cta";
import { SampleAiCard } from "@/components/landing/sample-ai-card";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Logo />
        <div className="flex items-center gap-3">
          <Button variant="ghost" render={<Link href="/login" />}>
            Giriş Yap
          </Button>
          <Button
            render={<Link href="/login" />}
            className="bg-ai-primary hover:bg-ai-primary/90 text-white"
          >
            Kayıt Ol
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col justify-center py-20">
        <HeroSection />
        <EmailCta />
        <SampleAiCard />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Bistbase. Tüm hakları saklıdır.
        </p>
        <SpkDisclaimer />
      </footer>
    </div>
  );
}
