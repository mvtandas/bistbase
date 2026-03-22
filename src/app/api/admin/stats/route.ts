import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalUsers,
    newToday,
    newThisWeek,
    premiumUsers,
    totalPortfolios,
    uniqueStocks,
    recentCrons,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.user.count({ where: { plan: "PREMIUM" } }),
    prisma.portfolio.count(),
    prisma.portfolio.groupBy({ by: ["stockCode"] }).then((r) => r.length),
    prisma.cronLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    newToday,
    newThisWeek,
    premiumUsers,
    totalPortfolios,
    uniqueStocks,
    recentCrons,
  });
}
