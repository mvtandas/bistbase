import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/shared/logo";
import { StockSearch } from "@/components/onboarding/stock-search";

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
    <div className="flex flex-col min-h-screen items-center justify-center px-4">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Hangi hisseleri takip etmek istersiniz?
        </h1>
        <p className="text-muted-foreground mt-2">
          Portföyünüze eklemek istediğiniz BİST hisselerini arayın ve seçin.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Ücretsiz planda 2 hisse takip edebilirsiniz.
        </p>
      </div>

      <StockSearch />
    </div>
  );
}
