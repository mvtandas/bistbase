import { NextRequest, NextResponse } from "next/server";
import { getStockQuote } from "@/lib/stock/yahoo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const quote = await getStockQuote(code);

  if (!quote) {
    return NextResponse.json(
      { error: "Hisse verisi alınamadı" },
      { status: 404 }
    );
  }

  return NextResponse.json(quote);
}
