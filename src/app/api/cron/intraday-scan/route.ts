import { NextRequest, NextResponse } from "next/server";
import { runIntradayScan } from "@/lib/cron/intraday-scan";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const partition = request.nextUrl.searchParams.get("partition"); // "1", "2", "3", "4" veya null (tümü)
    const result = await runIntradayScan(force, partition ? parseInt(partition) : undefined);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Intraday scan failed:", error);
    return NextResponse.json(
      { error: "Intraday tarama başarısız oldu" },
      { status: 500 }
    );
  }
}
