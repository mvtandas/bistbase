import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzePortfolioRisk } from "@/lib/stock/portfolio-risk";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true },
  });

  const stockCodes = portfolios.map((p) => p.stockCode);
  if (stockCodes.length < 2) {
    return NextResponse.json({ error: "En az 2 hisse gerekli" }, { status: 400 });
  }

  try {
    const risk = await analyzePortfolioRisk(stockCodes);
    return NextResponse.json(risk);
  } catch (error) {
    console.error("Portfolio risk analysis failed:", error);
    return NextResponse.json({ error: "Risk analizi başarısız" }, { status: 500 });
  }
}
