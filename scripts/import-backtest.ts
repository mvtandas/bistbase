/**
 * Import backtest JSON results into BacktestReport table
 * Kullanım: npx tsx scripts/import-backtest.ts data/results/v1-bist100-2026-03-23.json
 */

import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Kullanım: npx tsx scripts/import-backtest.ts <dosya.json>");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(file, "utf-8"));

  const report = await prisma.backtestReport.create({
    data: {
      name: data.meta.name,
      scope: data.meta.scope,
      totalStocks: data.meta.stocks,
      totalSignals: data.meta.totalSignals,
      totalVerdicts: data.meta.totalVerdicts,
      avgWinRate: data.overall.avgWinRate,
      signalPerformance: data.signalPerformance,
      verdictPerformance: data.verdictPerformance,
      byIndex: data.byIndex ?? null,
      overall: data.overall ?? null,
      meta: data.meta ?? null,
    },
  });

  console.log(`Imported: ${report.name} (id: ${report.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
