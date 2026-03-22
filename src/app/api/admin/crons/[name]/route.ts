import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const CRON_PATHS: Record<string, string> = {
  "analyze": "/api/cron/analyze",
  "track-signals": "/api/cron/track-signals",
  "morning-digest": "/api/cron/morning-digest",
  "track-verdicts": "/api/cron/track-verdicts",
  "weekly-report": "/api/cron/weekly-report",
  "score-change-alerts": "/api/cron/score-change-alerts",
  "macro-alerts": "/api/cron/macro-alerts",
  "screener-analysis": "/api/cron/screener-analysis",
  "portfolio-snapshot": "/api/cron/portfolio-snapshot",
  "backfill-signals": "/api/cron/backfill-signals",
  "backfill-verdicts": "/api/cron/backfill-verdicts",
  "backfill": "/api/cron/backfill",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { name } = await params;
  const cronPath = CRON_PATHS[name];

  if (!cronPath) {
    return NextResponse.json({ error: "Unknown cron" }, { status: 404 });
  }

  // Prevent double-trigger: check if running in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const running = await prisma.cronLog.findFirst({
    where: {
      cronName: name,
      status: "RUNNING",
      startedAt: { gte: fiveMinAgo },
    },
  });

  if (running) {
    return NextResponse.json(
      { error: "Bu cron zaten çalışıyor. Lütfen bekleyin." },
      { status: 409 }
    );
  }

  // Trigger the cron endpoint internally
  const baseUrl = request.nextUrl.origin;
  const cronSecret = process.env.CRON_SECRET;

  // Fire and forget - create log entry and call cron
  const log = await prisma.cronLog.create({
    data: { cronName: name, status: "RUNNING" },
  });

  const start = Date.now();

  try {
    const res = await fetch(`${baseUrl}${cronPath}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });

    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = undefined;
    try {
      result = JSON.parse(text);
    } catch {
      result = { response: text };
    }

    await prisma.cronLog.update({
      where: { id: log.id },
      data: {
        status: res.ok ? "SUCCESS" : "FAILED",
        duration: Date.now() - start,
        result,
        endedAt: new Date(),
        ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
      },
    });

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      duration: Date.now() - start,
    });
  } catch (err) {
    await prisma.cronLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        duration: Date.now() - start,
        error: String(err),
        endedAt: new Date(),
      },
    });

    return NextResponse.json(
      { error: "Cron çalıştırılamadı", detail: String(err) },
      { status: 500 }
    );
  }
}
