import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const action = process.argv[2] ?? "status";

  const account = await prisma.paperAccount.findFirst();
  if (!account) { console.log("Hesap yok."); return; }

  if (action === "reset") {
    // Tüm trade'leri sil, hesabı sıfırla
    await prisma.paperTrade.deleteMany({ where: { accountId: account.id } });
    await prisma.paperEquitySnapshot.deleteMany({ where: { accountId: account.id } });
    await prisma.paperAccount.update({
      where: { id: account.id },
      data: {
        currentBalance: 100000,
        totalPnl: 0,
        totalTrades: 0,
        winCount: 0,
        lossCount: 0,
        totalCommission: 0,
        maxDrawdown: 0,
        peakBalance: 100000,
        pausedUntil: null,
        pauseReason: null,
      },
    });
    console.log("Hesap sıfırlandı: ₺100.000, tüm trade'ler silindi.");
  } else if (action === "unpause") {
    await prisma.paperAccount.update({
      where: { id: account.id },
      data: { pausedUntil: null, pauseReason: null },
    });
    console.log("Circuit breaker kaldırıldı.");
  } else {
    console.log("Durum:", {
      balance: account.currentBalance,
      pnl: account.totalPnl,
      trades: account.totalTrades,
      scope: account.scope,
      paused: account.pausedUntil,
      pauseReason: account.pauseReason,
    });
  }
  await prisma.$disconnect();
}
main();
