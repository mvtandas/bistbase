import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";

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
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        userEmail={user?.email ?? ""}
        userPlan={user?.plan ?? "FREE"}
        portfolioStocks={portfolioStocks}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
