import { NextRequest, NextResponse } from "next/server";
import { runDailyAnalysis } from "@/lib/cron/analyze";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyAnalysis();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Cron analysis failed:", error);
    return NextResponse.json(
      { error: "Analiz başarısız oldu" },
      { status: 500 }
    );
  }
}
