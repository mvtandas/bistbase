import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileHeader } from "@/components/dashboard/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, plan: true },
  });

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true },
    orderBy: { addedAt: "asc" },
  });

  const portfolioStocks = portfolios.map((p) => p.stockCode);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Mobile header */}
      <MobileHeader
        userEmail={user?.email ?? ""}
        userPlan={user?.plan ?? "FREE"}
        portfolioStocks={portfolioStocks}
      />

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          userEmail={user?.email ?? ""}
          userPlan={user?.plan ?? "FREE"}
          portfolioStocks={portfolioStocks}
        />
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
