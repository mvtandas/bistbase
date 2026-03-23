import { NextRequest, NextResponse } from "next/server";
import { getBatchQuotes } from "@/lib/stock/yahoo";
import { getMarketState } from "@/lib/stock/market-hours";
import { rateLimitAsync } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const rl = await rateLimitAsync(`prices:${ip}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const codesParam = req.nextUrl.searchParams.get("codes");
  if (!codesParam) {
    return NextResponse.json({ error: "codes parameter required" }, { status: 400 });
  }

  const codes = codesParam
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50); // max 50 hisse

  if (codes.length === 0) {
    return NextResponse.json({ error: "No valid codes" }, { status: 400 });
  }

  const quotes = await getBatchQuotes(codes);
  const market = getMarketState();

  const data: Record<string, {
    code: string;
    name: string;
    price: number | null;
    changePercent: number | null;
    volume: number | null;
  }> = {};

  for (const [code, quote] of quotes) {
    data[code] = quote;
  }

  return NextResponse.json({
    prices: data,
    market: {
      isOpen: market.isOpen,
      isWeekend: market.isWeekend,
    },
    count: Object.keys(data).length,
  });
}
