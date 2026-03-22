import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { type, before } = body as { type: string; before?: string };

  const dateFilter = before ? { date: { lt: new Date(before) } } : {};

  let deleted = 0;

  switch (type) {
    case "ai-insights":
      deleted = (await prisma.aiInsight.deleteMany({ where: dateFilter })).count;
      break;
    case "screener":
      deleted = (await prisma.screenerSnapshot.deleteMany({ where: dateFilter })).count;
      break;
    case "technical":
      deleted = (await prisma.technicalSnapshot.deleteMany({ where: dateFilter })).count;
      break;
    case "cron-logs":
      deleted = (await prisma.cronLog.deleteMany({ where: before ? { startedAt: { lt: new Date(before) } } : {} })).count;
      break;
    default:
      return NextResponse.json({ error: "Invalid cache type" }, { status: 400 });
  }

  return NextResponse.json({ deleted, type });
}
