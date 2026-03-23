/**
 * Screener Analysis Cron
 * Tüm BİST hisselerini analiz edip ScreenerSnapshot tablosuna kaydeder.
 *
 * GET /api/cron/screener-analysis
 * Hafta içi günde 3 kez: 07:00, 12:00, 17:00 (İstanbul saati)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BIST_ALL, BIST30, BIST50, BIST100, BIST_TEMETTU25, BIST_KURUMSAL, BIST_SURDURULEBILIRLIK } from "@/lib/constants";
import { analyzeStock, toScreenerSnapshotData } from "@/lib/stock/batch-analysis";
import { getMacroData } from "@/lib/stock/macro";

export const maxDuration = 300; // 5 min timeout

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const bist30Set = new Set(BIST30);
const bist50Set = new Set(BIST50);
const bist100Set = new Set(BIST100);
const xtm25Set = new Set(BIST_TEMETTU25);
const xkurySet = new Set(BIST_KURUMSAL);
const xusrdSet = new Set(BIST_SURDURULEBILIRLIK);

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // İstanbul timezone'unda bugünün tarihini al (Vercel UTC'de çalışır, local TR'de)
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = dateStr.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, m - 1, d));

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Always re-analyze all stocks — screener runs 3x daily to capture intraday changes
    const toAnalyze = BIST_ALL;

    // 2. Shared macro data (one call for all stocks)
    const macroData = await getMacroData().catch(() => null);

    // 3. Analyze stocks with rate limiting (5 parallel, 1s stagger)
    for (let i = 0; i < toAnalyze.length; i += 5) {
      const batch = toAnalyze.slice(i, i + 5);

      const results = await Promise.allSettled(
        batch.map(code => analyzeStock(code, macroData, "daily"))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const code = batch[j];

        if (result.status === "fulfilled" && result.value) {
          try {
            const data = toScreenerSnapshotData(result.value, todayDate, {
              inBist30: bist30Set.has(code),
              inBist50: bist50Set.has(code),
              inBist100: bist100Set.has(code),
              inXtm25: xtm25Set.has(code),
              inXkury: xkurySet.has(code),
              inXusrd: xusrdSet.has(code),
            });

            await prisma.screenerSnapshot.upsert({
              where: { stockCode_date: { stockCode: code, date: todayDate } },
              create: data,
              update: { ...data, createdAt: new Date() },
            });
            processed++;
          } catch (dbErr) {
            console.error(`[screener-cron] DB error for ${code}:`, dbErr);
            failed++;
          }
        } else {
          console.warn(`[screener-cron] Analysis failed for ${code}:`, result.status === "rejected" ? result.reason : "null result");
          failed++;
        }
      }

      // Rate limiting: 1s between batches
      if (i + 5 < toAnalyze.length) {
        await sleep(1000);
      }
    }

    return NextResponse.json({
      message: `Screener analizi tamamlandı`,
      stats: { processed, skipped, failed, total: BIST_ALL.length },
    });
  } catch (error) {
    console.error("[screener-cron] Fatal error:", error);
    return NextResponse.json(
      { error: "Screener analizi başarısız", stats: { processed, skipped, failed } },
      { status: 500 },
    );
  }
}
