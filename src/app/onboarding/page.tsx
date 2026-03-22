import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWalkthrough } from "@/components/onboarding/onboarding-walkthrough";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // If user already has portfolio items, redirect to dashboard
  const portfolioCount = await prisma.portfolio.count({
    where: { userId: session.user.id },
  });

  if (portfolioCount > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      {/* Animated gradient orbs - matching login page aesthetic */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[20%] -top-[30%] h-[600px] w-[600px] rounded-full bg-ai-primary/[0.07] blur-[120px] animate-[drift_20s_ease-in-out_infinite]" />
        <div className="absolute -right-[15%] top-[20%] h-[500px] w-[500px] rounded-full bg-ai-premium/[0.05] blur-[100px] animate-[drift_25s_ease-in-out_infinite_reverse]" />
        <div className="absolute -bottom-[20%] left-[30%] h-[400px] w-[400px] rounded-full bg-gain/[0.04] blur-[100px] animate-[drift_18s_ease-in-out_infinite_2s]" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg animate-[fadeIn_0.6s_ease-out]">
        {/* Logo */}
        <div className="mb-10 text-center animate-[slideUp_0.5s_ease-out]">
          <a href="/" className="inline-block group">
            <span className="text-3xl font-bold tracking-tight text-foreground transition-colors">
              bist<span className="text-ai-primary group-hover:text-ai-premium transition-colors duration-300">base</span>
            </span>
          </a>
        </div>

        {/* Walkthrough */}
        <div className="animate-[slideUp_0.6s_ease-out_0.1s_both]">
          <OnboardingWalkthrough />
        </div>
      </div>
    </div>
  );
}
