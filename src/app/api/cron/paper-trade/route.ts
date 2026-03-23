import { NextRequest, NextResponse } from "next/server";
import { processPaperTrades } from "@/lib/stock/paper-trading";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  // Auth: CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  let cronLog;

  try {
    cronLog = await prisma.cronLog.create({
      data: { cronName: "paper-trade", status: "RUNNING" },
    });

    const result = await processPaperTrades();

    const duration = Date.now() - startTime;
    await prisma.cronLog.update({
      where: { id: cronLog.id },
      data: {
        status: "SUCCESS",
        duration,
        result: JSON.parse(JSON.stringify(result)),
        endedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, ...result, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";

    if (cronLog) {
      await prisma.cronLog.update({
        where: { id: cronLog.id },
        data: { status: "FAILED", duration, error: message, endedAt: new Date() },
      });
    }

    console.error("Paper trade cron failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
