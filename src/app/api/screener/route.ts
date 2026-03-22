import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getScreenerSnapshots, snapshotsToScreenerResult } from "@/lib/stock/screener-db";
import type { ScreenerIndex } from "@/lib/constants";

const VALID_INDICES = new Set<ScreenerIndex>(["bist30", "bist50", "bist100", "bistall", "xtm25", "xkury", "xusrd"]);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idx = request.nextUrl.searchParams.get("index") ?? "bist30";
  const index = VALID_INDICES.has(idx as ScreenerIndex) ? (idx as ScreenerIndex) : "bist30";

  try {
    const { snapshots, stale } = await getScreenerSnapshots(index);

    if (snapshots.length === 0) {
      return NextResponse.json({
        stocks: [],
        macroData: null,
        regime: "NORMAL",
        generatedAt: new Date().toISOString(),
        index,
        timeframe: "daily",
        sectorSummary: {},
        marketSummary: {
          avgComposite: 0, strongBuyCount: 0, buyCount: 0,
          holdCount: 0, sellCount: 0, strongSellCount: 0,
          bullishSignalCount: 0, bearishSignalCount: 0,
        },
        stale: true,
        message: "Henüz screener analizi çalıştırılmamış. Cron job'ı tetikleyin.",
      });
    }

    const result = snapshotsToScreenerResult(snapshots, index, stale);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[screener] error:", error);
    return NextResponse.json({ error: "Tarama verisi alınamadı" }, { status: 500 });
  }
}
