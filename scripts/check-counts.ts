import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.dailySummary.count({ where: { status: "COMPLETED", timeframe: "daily" } });
  const withVerdict = await prisma.dailySummary.count({ where: { verdictAction: { not: null }, timeframe: "daily" } });
  const withScore = await prisma.dailySummary.count({ where: { compositeScore: { not: null }, timeframe: "daily", status: "COMPLETED" } });
  const noVerdict = await prisma.dailySummary.count({ where: { verdictAction: null, compositeScore: { not: null }, timeframe: "daily", status: "COMPLETED" } });
  console.log(`Total completed daily: ${total}`);
  console.log(`With verdict: ${withVerdict}`);
  console.log(`With compositeScore: ${withScore}`);
  console.log(`Missing verdict (has score): ${noVerdict}`);
  await prisma.$disconnect();
}
main();
