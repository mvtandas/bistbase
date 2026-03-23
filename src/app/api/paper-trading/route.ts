import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStockQuote } from "@/lib/stock/yahoo";

// ═══ GET — Paper Trading Dashboard Data ═══

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Account bilgisi (yoksa null döner)
    const account = await prisma.paperAccount.findUnique({
      where: { userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ account: null, trades: [], equity: [], stats: null });
    }

    // Açık pozisyonlar (güncel fiyatlarla)
    const openTrades = await prisma.paperTrade.findMany({
      where: { accountId: account.id, status: "OPEN" },
      orderBy: { entryDate: "desc" },
    });

    // Açık pozisyonlara güncel fiyat ekle
    const openWithPrice = await Promise.all(
      openTrades.map(async (trade) => {
        const quote = await getStockQuote(trade.stockCode);
        const currentPrice = quote?.price ?? trade.entryPrice;
        const isShort = trade.verdictAction === "SAT" || trade.verdictAction === "GUCLU_SAT";
        const unrealizedPnl = isShort
          ? (trade.entryPrice - currentPrice) * trade.lots
          : (currentPrice - trade.entryPrice) * trade.lots;
        const unrealizedPct = (unrealizedPnl / (trade.entryPrice * trade.lots)) * 100;
        const holdingDays = Math.ceil((Date.now() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...trade,
          currentPrice,
          unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
          unrealizedPct: Math.round(unrealizedPct * 100) / 100,
          holdingDays,
        };
      }),
    );

    // Kapalı trade'ler (son 50)
    const closedTrades = await prisma.paperTrade.findMany({
      where: { accountId: account.id, status: { not: "OPEN" } },
      orderBy: { exitDate: "desc" },
      take: 50,
    });

    // Equity curve (son 90 gün)
    const equityCutoff = new Date();
    equityCutoff.setDate(equityCutoff.getDate() - 90);

    const equitySnapshots = await prisma.paperEquitySnapshot.findMany({
      where: { accountId: account.id, date: { gte: equityCutoff } },
      orderBy: { date: "asc" },
    });

    // İstatistikler
    const allClosedTrades = await prisma.paperTrade.findMany({
      where: { accountId: account.id, status: { not: "OPEN" } },
      select: { pnlAmount: true, pnlPercent: true, holdingDays: true, status: true, verdictAction: true },
    });

    const totalTrades = allClosedTrades.length;
    const wins = allClosedTrades.filter(t => (t.pnlAmount ?? 0) > 0);
    const losses = allClosedTrades.filter(t => (t.pnlAmount ?? 0) <= 0);
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;

    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnlPercent ?? 0), 0) / losses.length : 0;

    const grossWins = wins.reduce((s, t) => s + (t.pnlAmount ?? 0), 0);
    const grossLosses = Math.abs(losses.reduce((s, t) => s + (t.pnlAmount ?? 0), 0));
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? 99 : 0);

    const avgHoldingDays = totalTrades > 0
      ? allClosedTrades.reduce((s, t) => s + (t.holdingDays ?? 0), 0) / totalTrades
      : 0;

    // Verdikt bazlı breakdown
    const byVerdict: Record<string, { total: number; wins: number; avgPnl: number }> = {};
    for (const t of allClosedTrades) {
      const v = t.verdictAction;
      if (!byVerdict[v]) byVerdict[v] = { total: 0, wins: 0, avgPnl: 0 };
      byVerdict[v].total++;
      if ((t.pnlAmount ?? 0) > 0) byVerdict[v].wins++;
      byVerdict[v].avgPnl += t.pnlPercent ?? 0;
    }
    for (const v of Object.keys(byVerdict)) {
      byVerdict[v].avgPnl = byVerdict[v].total > 0 ? byVerdict[v].avgPnl / byVerdict[v].total : 0;
    }

    // Exit reason breakdown
    const byExitReason: Record<string, number> = {};
    for (const t of allClosedTrades) {
      const status = t.status;
      byExitReason[status] = (byExitReason[status] ?? 0) + 1;
    }

    // Toplam açık pozisyon değeri
    const openPositionsValue = openWithPrice.reduce((s, t) => s + t.currentPrice * t.lots, 0);
    const totalUnrealizedPnl = openWithPrice.reduce((s, t) => s + t.unrealizedPnl, 0);
    const portfolioValue = account.currentBalance + openPositionsValue;
    const totalReturn = ((portfolioValue - account.initialBalance) / account.initialBalance) * 100;

    return NextResponse.json({
      account: {
        ...account,
        portfolioValue: Math.round(portfolioValue * 100) / 100,
        totalReturn: Math.round(totalReturn * 100) / 100,
        openPositionsValue: Math.round(openPositionsValue * 100) / 100,
        totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      },
      openTrades: openWithPrice,
      closedTrades,
      equity: equitySnapshots,
      stats: {
        totalTrades,
        winRate: Math.round(winRate * 10) / 10,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
        byVerdict,
        byExitReason,
      },
    });
  } catch (error) {
    console.error("Paper trading GET failed:", error);
    return NextResponse.json({ error: "Veri yüklenemedi" }, { status: 500 });
  }
}

// ═══ POST — Activate Paper Trading ═══

// ═══ PATCH — Update scope ═══

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const scope = body.scope;
    const validScopes = ["bist30", "bist50", "bist100", "portfolio"];
    if (!scope || !validScopes.includes(scope)) {
      return NextResponse.json({ error: "Geçersiz scope" }, { status: 400 });
    }

    const account = await prisma.paperAccount.update({
      where: { userId: session.user.id },
      data: { scope },
    });

    return NextResponse.json({ success: true, scope: account.scope });
  } catch (error) {
    console.error("Paper trading PATCH failed:", error);
    return NextResponse.json({ error: "Scope güncellenemedi" }, { status: 500 });
  }
}

// ═══ POST — Activate Paper Trading ═══

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.paperAccount.findUnique({
      where: { userId: session.user.id },
    });

    if (existing) {
      return NextResponse.json({ error: "Zaten aktif bir paper trading hesabınız var" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope ?? "bist100";
    const validScopes = ["bist30", "bist50", "bist100", "portfolio"];
    if (!validScopes.includes(scope)) {
      return NextResponse.json({ error: "Geçersiz scope" }, { status: 400 });
    }

    const account = await prisma.paperAccount.create({
      data: {
        userId: session.user.id,
        initialBalance: 100000,
        currentBalance: 100000,
        peakBalance: 100000,
        scope,
      },
    });

    return NextResponse.json({ success: true, account });
  } catch (error) {
    console.error("Paper trading POST failed:", error);
    return NextResponse.json({ error: "Hesap oluşturulamadı" }, { status: 500 });
  }
}
