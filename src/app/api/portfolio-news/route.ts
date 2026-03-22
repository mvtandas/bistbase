import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStockNews } from "@/lib/news/kap-rss";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ news: [] }, { status: 401 });
    }

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: session.user.id },
      select: { stockCode: true },
    });

    const stockCodes = portfolios.map((p) => p.stockCode);
    if (stockCodes.length === 0) {
      return NextResponse.json({ news: [] });
    }

    // Fetch news for all stocks in parallel
    const results = await Promise.all(
      stockCodes.map(async (code) => {
        const headlines = await getStockNews(code);
        return headlines.map((title) => ({ stockCode: code, title }));
      })
    );

    const news = results.flat().slice(0, 15);

    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
