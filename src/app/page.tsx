import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { StockTicker } from "@/components/landing/stock-ticker";
import { SocialProof } from "@/components/landing/social-proof";
import { FeaturesBento } from "@/components/landing/features-bento";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LiveDemo } from "@/components/landing/live-demo";
import { Testimonials } from "@/components/landing/testimonials";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { CursorGlow } from "@/components/landing/cursor-glow";
import { ScrollProgress } from "@/components/landing/scroll-progress";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen noise-overlay">
      <ScrollProgress />
      <CursorGlow />
      <Navbar />
      <main>
        <HeroSection />
        <StockTicker />
        <SocialProof />
        <FeaturesBento />
        <HowItWorks />
        <LiveDemo />
        <Testimonials />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
