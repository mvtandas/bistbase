import { NextRequest, NextResponse } from "next/server";
import { BIST_ALL } from "@/lib/constants";
import { STOCK_NAMES } from "@/lib/stock/stock-names";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const q = query.toUpperCase();
  const qLower = query.toLowerCase();

  const results = BIST_ALL
    .filter((code) => {
      if (code.includes(q)) return true;
      const name = STOCK_NAMES[code];
      if (name && name.toLowerCase().includes(qLower)) return true;
      return false;
    })
    .slice(0, 20)
    .map((code) => ({
      code,
      name: STOCK_NAMES[code] ?? code,
    }));

  return NextResponse.json(results);
}
