import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

const CRON_JOBS = [
  { name: "analyze", label: "Günlük Analiz", schedule: "Her hafta içi 18:00" },
  { name: "track-signals", label: "Sinyal Takibi", schedule: "Her hafta içi 18:30" },
  { name: "morning-digest", label: "Sabah Özeti", schedule: "Her hafta içi 08:30" },
  { name: "track-verdicts", label: "Karar Takibi", schedule: "Her hafta içi 18:45" },
  { name: "weekly-report", label: "Haftalık Rapor", schedule: "Her Cuma 19:00" },
  { name: "score-change-alerts", label: "Skor Değişim", schedule: "Her hafta içi 19:00" },
  { name: "macro-alerts", label: "Makro Uyarılar", schedule: "Her hafta içi 17:00" },
  { name: "screener-analysis", label: "Tarama Analizi", schedule: "Her hafta içi 07:00, 12:00, 17:00" },
  { name: "portfolio-snapshot", label: "Portföy Snapshot", schedule: "Her hafta içi 19:15" },
  { name: "backfill-signals", label: "Sinyal Backfill", schedule: "Manuel" },
  { name: "backfill-verdicts", label: "Karar Backfill", schedule: "Manuel" },
  { name: "backfill", label: "Veri Backfill", schedule: "Manuel" },
];

export { CRON_JOBS };

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  // Get latest log per cron
  const latestLogs = await prisma.cronLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const latestPerCron = new Map<string, typeof latestLogs[0]>();
  for (const log of latestLogs) {
    if (!latestPerCron.has(log.cronName)) {
      latestPerCron.set(log.cronName, log);
    }
  }

  const result = CRON_JOBS.map((job) => ({
    ...job,
    lastRun: latestPerCron.get(job.name) || null,
  }));

  return NextResponse.json(result);
}
