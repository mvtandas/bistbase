import { prisma } from "../src/lib/prisma";
async function main() {
  const total = await prisma.signal.count();
  const withOutcome = await prisma.signal.count({ where: { wasAccurate: { not: null } } });
  const accurate = await prisma.signal.count({ where: { wasAccurate: true } });
  console.log("=== SINYAL VERI DURUMU ===");
  console.log("Toplam sinyal:", total);
  console.log("Sonucu olan:", withOutcome);
  console.log("Dogru cikan:", accurate);
  if (total > 0) {
    const types: any[] = await prisma.$queryRaw`SELECT "signalType", COUNT(*)::int as cnt FROM "Signal" GROUP BY "signalType" ORDER BY cnt DESC LIMIT 15`;
    console.log("\nSINYAL TIPLERI:");
    for (const t of types) console.log(" ", t.signalType, ":", t.cnt);
    const stocks: any[] = await prisma.$queryRaw`SELECT "stockCode", COUNT(*)::int as cnt FROM "Signal" GROUP BY "stockCode" ORDER BY cnt DESC LIMIT 10`;
    console.log("\nHISSELER:");
    for (const s of stocks) console.log(" ", s.stockCode, ":", s.cnt);
    const dates: any[] = await prisma.$queryRaw`SELECT MIN("date")::text as earliest, MAX("date")::text as latest FROM "Signal"`;
    console.log("\nTARIH:", dates[0].earliest, "-", dates[0].latest);
  } else {
    console.log("\nDB'de hic sinyal verisi yok!");
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
