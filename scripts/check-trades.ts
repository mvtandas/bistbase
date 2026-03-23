import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const trades = await prisma.paperTrade.findMany({
    where: { status: "OPEN" },
    select: { stockCode: true, action: true, lots: true, entryPrice: true, stopLoss: true, takeProfit: true, verdictAction: true, confidence: true, entryDate: true, maxHoldingDays: true },
    orderBy: { confidence: "desc" },
  });

  const account = await prisma.paperAccount.findFirst({
    select: { currentBalance: true, initialBalance: true, scope: true, totalTrades: true, winCount: true, lossCount: true, totalPnl: true },
  });

  console.log("═══ PAPER TRADING — CANLI DURUM ═══\n");
  if (account) {
    console.log(`Hesap: ₺${account.currentBalance.toFixed(0)} / ₺${account.initialBalance.toFixed(0)} | Scope: ${account.scope} | P&L: ₺${account.totalPnl.toFixed(0)} | ${account.winCount}W/${account.lossCount}L`);
  }
  console.log(`Açık pozisyon: ${trades.length}\n`);

  for (const t of trades) {
    const slDist = Math.abs(t.entryPrice - t.stopLoss);
    const tpDist = Math.abs(t.takeProfit - t.entryPrice);
    const rr = slDist > 0 ? (tpDist / slDist).toFixed(1) : "?";
    const slPct = ((t.stopLoss - t.entryPrice) / t.entryPrice * 100).toFixed(1);
    const tpPct = ((t.takeProfit - t.entryPrice) / t.entryPrice * 100).toFixed(1);

    console.log(
      `${t.stockCode.padEnd(8)} ${t.verdictAction.padEnd(10)} Conf:${String(t.confidence).padEnd(3)} | Giriş: ₺${t.entryPrice.toFixed(2)} | SL: ${slPct}% TP: +${tpPct}% | R:R ${rr}:1 | ${t.lots} lot | ${t.maxHoldingDays}g max`
    );
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
