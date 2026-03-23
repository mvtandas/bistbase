/**
 * Paper Trading Engine
 * Sanal portföyde verdiktlere göre otomatik al-sat
 */

import { prisma } from "@/lib/prisma";
import { getIstanbulToday } from "@/lib/date-utils";
import { getStockQuote } from "./yahoo";
import { generateExitRules } from "./exit-rules";
import { calculatePositionSize } from "./position-sizing";
import { calculateCommission, EFFECTIVE_COST_PER_SIDE } from "./bist-constants";
import { BIST30, BIST50, BIST100, BIST_ALL } from "@/lib/constants";
import type { VerdictAction } from "./verdict";

function getScopeStocks(scope: string): string[] {
  switch (scope) {
    case "bist30": return [...new Set(BIST30)];
    case "bist50": return [...new Set(BIST50)];
    case "bist100": return [...new Set(BIST100)];
    case "bist-all": return [...new Set(BIST_ALL)];
    default: return []; // portfolio — ayrı çekilir
  }
}

// ═══ Circuit Breaker Thresholds ═══

/** Günlük kayıp limiti (portföy yüzdesi) */
const DAILY_LOSS_LIMIT = -0.03; // -%3

/** Haftalık kayıp limiti */
const WEEKLY_LOSS_LIMIT = -0.05; // -%5

/** Max drawdown limiti */
const MAX_DRAWDOWN_LIMIT = -0.10; // -%10

/** Ardışık kayıp sonrası duraklama */
const MAX_CONSECUTIVE_LOSSES = 5;

/** Duraklama süresi (gün) */
const PAUSE_DAYS = 3;

/** Maksimum açık pozisyon */
const MAX_OPEN_POSITIONS = 8;

// ═══ Types ═══

interface TradeAction {
  type: "OPEN" | "CLOSE";
  stockCode: string;
  reason: string;
  price: number;
}

interface ProcessResult {
  opened: number;
  closed: number;
  errors: string[];
  circuitBreaker: boolean;
}

// ═══ Main Entry Point ═══

/**
 * Her gün market kapanışında çağrılır.
 * 1. Circuit breaker kontrolü
 * 2. Mevcut açık pozisyonları kontrol et (SL/TP/zaman aşımı)
 * 3. Yeni verdiktlere göre pozisyon aç
 * 4. Equity snapshot kaydet
 */
export async function processPaperTrades(): Promise<ProcessResult> {
  const result: ProcessResult = { opened: 0, closed: 0, errors: [], circuitBreaker: false };

  // Tüm aktif paper account'ları al
  const accounts = await prisma.paperAccount.findMany({
    where: { isActive: true },
    include: {
      trades: { where: { status: "OPEN" } },
    },
  });

  for (const account of accounts) {
    try {
      // 1. Circuit breaker kontrolü
      if (account.pausedUntil && account.pausedUntil > new Date()) {
        result.circuitBreaker = true;
        continue;
      }

      // Eğer pause süresi dolmuşsa, temizle
      if (account.pausedUntil && account.pausedUntil <= new Date()) {
        await prisma.paperAccount.update({
          where: { id: account.id },
          data: { pausedUntil: null, pauseReason: null },
        });
      }

      // 2. Açık pozisyonları kontrol et ve kapat (SL/TP/zaman)
      for (const trade of account.trades) {
        try {
          const closeResult = await checkAndCloseTrade(trade, account);
          if (closeResult) result.closed++;
        } catch (err) {
          result.errors.push(`Close ${trade.stockCode}: ${(err as Error).message}`);
        }
      }

      // 3. Yeni verdiktlere göre pozisyon aç
      const openCount = await prisma.paperTrade.count({
        where: { accountId: account.id, status: "OPEN" },
      });

      if (openCount < MAX_OPEN_POSITIONS) {
        const opened = await openNewPositions(account, MAX_OPEN_POSITIONS - openCount);
        result.opened += opened;
      }

      // 4. Equity snapshot kaydet
      await saveEquitySnapshot(account);

      // 5. Circuit breaker kontrolü (günlük kayıp, drawdown)
      await checkCircuitBreaker(account);

    } catch (err) {
      result.errors.push(`Account ${account.id}: ${(err as Error).message}`);
    }
  }

  return result;
}

// ═══ Close Trades ═══

async function checkAndCloseTrade(
  trade: { id: string; stockCode: string; entryPrice: number; stopLoss: number; takeProfit: number; trailingStop: number | null; entryDate: Date; maxHoldingDays: number; lots: number; verdictAction: string; accountId: string },
  account: { id: string; currentBalance: number },
): Promise<boolean> {
  const quote = await getStockQuote(trade.stockCode);
  if (!quote?.price) return false;

  const price = quote.price;
  const isShort = trade.verdictAction === "SAT" || trade.verdictAction === "GUCLU_SAT";
  const holdingDays = Math.ceil((Date.now() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24));

  // Trailing stop güncelleme
  let activeStop = trade.trailingStop ?? trade.stopLoss;
  if (!isShort && price > trade.entryPrice * 1.03) {
    // %3+ kârda → trailing stop aktifleştir
    const trailLevel = price - (trade.entryPrice - trade.stopLoss) * 0.8;
    if (trailLevel > activeStop) {
      activeStop = trailLevel;
      await prisma.paperTrade.update({
        where: { id: trade.id },
        data: { trailingStop: activeStop },
      });
    }
  }

  // Exit kontrolleri
  let closeReason: string | null = null;
  let closeStatus: string = "OPEN";

  if (!isShort) {
    // Long pozisyon
    if (price <= activeStop) { closeReason = `Stop-loss: ₺${activeStop.toFixed(2)}`; closeStatus = trade.trailingStop ? "CLOSED_TRAIL" : "CLOSED_SL"; }
    else if (price >= trade.takeProfit) { closeReason = `Take-profit: ₺${trade.takeProfit.toFixed(2)}`; closeStatus = "CLOSED_TP"; }
  } else {
    // Short pozisyon
    if (price >= activeStop) { closeReason = `Stop-loss: ₺${activeStop.toFixed(2)}`; closeStatus = trade.trailingStop ? "CLOSED_TRAIL" : "CLOSED_SL"; }
    else if (price <= trade.takeProfit) { closeReason = `Take-profit: ₺${trade.takeProfit.toFixed(2)}`; closeStatus = "CLOSED_TP"; }
  }

  // Zaman aşımı
  if (!closeReason && holdingDays >= trade.maxHoldingDays) {
    closeReason = `Zaman aşımı: ${holdingDays} gün`;
    closeStatus = "CLOSED_TIME";
  }

  // Verdikt değişimi kontrolü
  if (!closeReason) {
    const latestSummary = await prisma.dailySummary.findFirst({
      where: { stockCode: trade.stockCode, verdictAction: { not: null }, status: "COMPLETED" },
      orderBy: { date: "desc" },
      select: { verdictAction: true },
    });

    if (latestSummary?.verdictAction) {
      const wasLong = trade.verdictAction === "GUCLU_AL" || trade.verdictAction === "AL";
      const nowSell = latestSummary.verdictAction === "SAT" || latestSummary.verdictAction === "GUCLU_SAT";
      const wasShort = trade.verdictAction === "SAT" || trade.verdictAction === "GUCLU_SAT";
      const nowBuy = latestSummary.verdictAction === "GUCLU_AL" || latestSummary.verdictAction === "AL";

      if ((wasLong && nowSell) || (wasShort && nowBuy)) {
        closeReason = `Verdikt değişimi: ${trade.verdictAction} → ${latestSummary.verdictAction}`;
        closeStatus = "CLOSED_VERDICT";
      }
    }
  }

  if (!closeReason) return false;

  // Pozisyonu kapat
  const exitValue = trade.lots * price;
  const exitCommission = calculateCommission(exitValue);
  const entryValue = trade.lots * trade.entryPrice;
  const entryCommission = calculateCommission(entryValue);
  const totalCommission = entryCommission + exitCommission;

  let pnlAmount: number;
  if (isShort) {
    pnlAmount = (trade.entryPrice - price) * trade.lots - totalCommission;
  } else {
    pnlAmount = (price - trade.entryPrice) * trade.lots - totalCommission;
  }
  const pnlPercent = (pnlAmount / entryValue) * 100;
  const isWin = pnlAmount > 0;

  await prisma.paperTrade.update({
    where: { id: trade.id },
    data: {
      status: closeStatus,
      exitPrice: price,
      exitDate: new Date(),
      exitReason: closeReason,
      pnlAmount: Math.round(pnlAmount * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      commission: Math.round(totalCommission * 100) / 100,
      holdingDays,
    },
  });

  // Account güncelle
  const newBalance = account.currentBalance + pnlAmount;
  await prisma.paperAccount.update({
    where: { id: account.id },
    data: {
      currentBalance: Math.round(newBalance * 100) / 100,
      totalPnl: { increment: Math.round(pnlAmount * 100) / 100 },
      totalTrades: { increment: 1 },
      winCount: isWin ? { increment: 1 } : undefined,
      lossCount: !isWin ? { increment: 1 } : undefined,
      totalCommission: { increment: Math.round(totalCommission * 100) / 100 },
    },
  });

  return true;
}

// ═══ Open Positions ═══

async function openNewPositions(
  account: { id: string; currentBalance: number; userId: string; scope: string },
  maxNew: number,
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Scope'a göre hisse listesi belirle
  let stockCodes: string[];
  if (account.scope === "portfolio") {
    const userPortfolio = await prisma.portfolio.findMany({
      where: { userId: account.userId },
      select: { stockCode: true },
    });
    if (userPortfolio.length === 0) return 0;
    stockCodes = userPortfolio.map(p => p.stockCode);
  } else {
    stockCodes = getScopeStocks(account.scope);
  }

  // En son verdiktleri al (bugün veya en son iş günü)
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const todaySummaries = await prisma.dailySummary.findMany({
    where: {
      stockCode: { in: stockCodes },
      verdictAction: { in: ["GUCLU_AL", "AL", "SAT", "GUCLU_SAT"] },
      status: "COMPLETED",
      date: { gte: threeDaysAgo },
    },
    select: {
      stockCode: true,
      verdictAction: true,
      verdictConfidence: true,
      closePrice: true,
    },
    orderBy: { verdictConfidence: "desc" },
  });

  // Zaten açık olan pozisyonları filtrele
  const openTrades = await prisma.paperTrade.findMany({
    where: { accountId: account.id, status: "OPEN" },
    select: { stockCode: true },
  });
  const openSet = new Set(openTrades.map(t => t.stockCode));

  let opened = 0;

  for (const summary of todaySummaries) {
    if (opened >= maxNew) break;
    if (openSet.has(summary.stockCode)) continue;
    if (!summary.closePrice || !summary.verdictConfidence) continue;

    // Minimum confidence eşiği
    if (summary.verdictConfidence < 5) continue; // Düşürüldü — simülasyonda conf düşük çıkabiliyor

    const action = summary.verdictAction as VerdictAction;
    const price = summary.closePrice;
    const confidence = summary.verdictConfidence;

    // ATR bilgisi al
    const techSnap = await prisma.technicalSnapshot.findFirst({
      where: { stockCode: summary.stockCode },
      orderBy: { date: "desc" },
      select: { atr14: true },
    });

    const atr14 = techSnap?.atr14 ?? null;

    // Exit rules
    const exitRules = generateExitRules(action, price, atr14, confidence);

    // Position sizing
    const sizing = calculatePositionSize(
      account.currentBalance,
      price,
      exitRules.stopLoss,
      action,
      confidence,
    );

    if (sizing.lots < 1) continue;
    if (sizing.totalCost > account.currentBalance * 0.95) continue; // %5 nakit rezervi

    // Sinyalleri al
    const todaySignals = await prisma.signal.findMany({
      where: {
        stockCode: summary.stockCode,
        date: { gte: today },
        signalDirection: { in: ["BULLISH", "BEARISH"] },
      },
      select: { signalType: true },
      take: 5,
    });

    // Pozisyon aç
    await prisma.paperTrade.create({
      data: {
        accountId: account.id,
        stockCode: summary.stockCode,
        action: action === "SAT" || action === "GUCLU_SAT" ? "SELL" : "BUY",
        lots: sizing.lots,
        entryPrice: price,
        stopLoss: exitRules.stopLoss,
        takeProfit: exitRules.takeProfit,
        maxHoldingDays: exitRules.maxHoldingDays,
        verdictAction: action,
        confidence,
        signalTypes: todaySignals.map(s => s.signalType).join(",") || null,
      },
    });

    // Nakit düş
    await prisma.paperAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: { decrement: Math.round(sizing.totalCost * 100) / 100 },
      },
    });

    openSet.add(summary.stockCode);
    opened++;
  }

  return opened;
}

// ═══ Equity Snapshot ═══

async function saveEquitySnapshot(
  account: { id: string; currentBalance: number; peakBalance: number; initialBalance: number; maxDrawdown: number },
): Promise<void> {
  const dateOnly = getIstanbulToday();

  // Açık pozisyonların değerini hesapla
  const openTrades = await prisma.paperTrade.findMany({
    where: { accountId: account.id, status: "OPEN" },
    select: { stockCode: true, lots: true, entryPrice: true, verdictAction: true },
  });

  let positionsValue = 0;
  for (const trade of openTrades) {
    const quote = await getStockQuote(trade.stockCode);
    const price = quote?.price ?? trade.entryPrice;
    positionsValue += trade.lots * price;
  }

  const portfolioValue = account.currentBalance + positionsValue;

  // Drawdown hesapla
  const peak = Math.max(account.peakBalance, portfolioValue);
  const drawdown = peak > 0 ? ((portfolioValue - peak) / peak) * 100 : 0;

  // Peak güncelle
  if (portfolioValue > account.peakBalance) {
    await prisma.paperAccount.update({
      where: { id: account.id },
      data: {
        peakBalance: portfolioValue,
        maxDrawdown: Math.min(account.maxDrawdown, drawdown),
      },
    });
  } else {
    // Drawdown güncelle
    if (drawdown < account.maxDrawdown) {
      await prisma.paperAccount.update({
        where: { id: account.id },
        data: { maxDrawdown: drawdown },
      });
    }
  }

  // Önceki snapshot ile karşılaştır
  const prevSnapshot = await prisma.paperEquitySnapshot.findFirst({
    where: { accountId: account.id },
    orderBy: { date: "desc" },
  });

  const dailyPnl = prevSnapshot ? portfolioValue - prevSnapshot.portfolioValue : 0;
  const dailyPnlPct = prevSnapshot && prevSnapshot.portfolioValue > 0
    ? (dailyPnl / prevSnapshot.portfolioValue) * 100
    : 0;

  await prisma.paperEquitySnapshot.upsert({
    where: { accountId_date: { accountId: account.id, date: dateOnly } },
    create: {
      accountId: account.id,
      date: dateOnly,
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      cashBalance: Math.round(account.currentBalance * 100) / 100,
      openPositions: openTrades.length,
      dailyPnl: Math.round(dailyPnl * 100) / 100,
      dailyPnlPct: Math.round(dailyPnlPct * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    },
    update: {
      portfolioValue: Math.round(portfolioValue * 100) / 100,
      cashBalance: Math.round(account.currentBalance * 100) / 100,
      openPositions: openTrades.length,
      dailyPnl: Math.round(dailyPnl * 100) / 100,
      dailyPnlPct: Math.round(dailyPnlPct * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    },
  });
}

// ═══ Circuit Breaker ═══

async function checkCircuitBreaker(
  account: { id: string; initialBalance: number; currentBalance: number; peakBalance: number },
): Promise<void> {
  // 1. Max drawdown kontrolü
  const portfolioValue = account.currentBalance; // simplified — snapshot'taki değeri kullan
  const drawdownPct = (portfolioValue - account.peakBalance) / account.peakBalance;

  if (drawdownPct <= MAX_DRAWDOWN_LIMIT) {
    await pauseAccount(account.id, PAUSE_DAYS * 3, `Max drawdown aşıldı: %${(drawdownPct * 100).toFixed(1)}`);
    // Tüm açık pozisyonları kapat
    await closeAllPositions(account.id, "Circuit breaker: Max drawdown");
    return;
  }

  // 2. Günlük kayıp kontrolü
  const todaySnapshot = await prisma.paperEquitySnapshot.findFirst({
    where: { accountId: account.id },
    orderBy: { date: "desc" },
  });

  if (todaySnapshot?.dailyPnlPct && todaySnapshot.dailyPnlPct / 100 <= DAILY_LOSS_LIMIT) {
    await pauseAccount(account.id, 1, `Günlük kayıp limiti: %${todaySnapshot.dailyPnlPct.toFixed(1)}`);
    return;
  }

  // 3. Ardışık kayıp kontrolü
  const recentTrades = await prisma.paperTrade.findMany({
    where: { accountId: account.id, status: { not: "OPEN" } },
    orderBy: { exitDate: "desc" },
    take: MAX_CONSECUTIVE_LOSSES,
    select: { pnlAmount: true },
  });

  if (recentTrades.length >= MAX_CONSECUTIVE_LOSSES) {
    const allLosses = recentTrades.every(t => (t.pnlAmount ?? 0) < 0);
    if (allLosses) {
      await pauseAccount(account.id, PAUSE_DAYS, `${MAX_CONSECUTIVE_LOSSES} ardışık kayıp`);
    }
  }
}

async function pauseAccount(accountId: string, days: number, reason: string): Promise<void> {
  const pauseUntil = new Date();
  pauseUntil.setDate(pauseUntil.getDate() + days);

  await prisma.paperAccount.update({
    where: { id: accountId },
    data: { pausedUntil: pauseUntil, pauseReason: reason },
  });
}

async function closeAllPositions(accountId: string, reason: string): Promise<void> {
  const openTrades = await prisma.paperTrade.findMany({
    where: { accountId, status: "OPEN" },
  });

  const account = await prisma.paperAccount.findUnique({ where: { id: accountId } });
  if (!account) return;

  for (const trade of openTrades) {
    const quote = await getStockQuote(trade.stockCode);
    const price = quote?.price ?? trade.entryPrice;
    const isShort = trade.verdictAction === "SAT" || trade.verdictAction === "GUCLU_SAT";

    const exitValue = trade.lots * price;
    const exitComm = calculateCommission(exitValue);
    const entryValue = trade.lots * trade.entryPrice;
    const entryComm = calculateCommission(entryValue);
    const totalComm = entryComm + exitComm;

    const pnl = isShort
      ? (trade.entryPrice - price) * trade.lots - totalComm
      : (price - trade.entryPrice) * trade.lots - totalComm;

    const holdingDays = Math.ceil((Date.now() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24));

    await prisma.paperTrade.update({
      where: { id: trade.id },
      data: {
        status: "CLOSED_CIRCUIT",
        exitPrice: price,
        exitDate: new Date(),
        exitReason: reason,
        pnlAmount: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round((pnl / entryValue) * 100 * 100) / 100,
        commission: Math.round(totalComm * 100) / 100,
        holdingDays,
      },
    });

    await prisma.paperAccount.update({
      where: { id: accountId },
      data: {
        currentBalance: { increment: exitValue - exitComm },
        totalPnl: { increment: Math.round(pnl * 100) / 100 },
        totalTrades: { increment: 1 },
        totalCommission: { increment: Math.round(totalComm * 100) / 100 },
        ...(pnl > 0 ? { winCount: { increment: 1 } } : { lossCount: { increment: 1 } }),
      },
    });
  }
}
