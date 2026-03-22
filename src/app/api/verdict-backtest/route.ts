import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateVerdictBacktest } from "@/lib/stock/verdict-backtest";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stockCode = searchParams.get("stockCode") || null;
  const days = parseInt(searchParams.get("days") ?? "180", 10);

  try {
    const result = await calculateVerdictBacktest(stockCode, days);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Verdict backtest failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Backtest failed", detail: message }, { status: 500 });
  }
}
