import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const updateData: Record<string, boolean> = {};
  if (body.morningDigest !== undefined) updateData.morningDigest = body.morningDigest;
  if (body.signalAlerts !== undefined) updateData.signalAlerts = body.signalAlerts;
  if (body.scoreChangeAlerts !== undefined) updateData.scoreChangeAlerts = body.scoreChangeAlerts;
  if (body.macroAlerts !== undefined) updateData.macroAlerts = body.macroAlerts;
  if (body.weeklyReport !== undefined) updateData.weeklyReport = body.weeklyReport;

  const prefs = await prisma.alertPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      morningDigest: body.morningDigest ?? true,
      signalAlerts: body.signalAlerts ?? true,
      scoreChangeAlerts: body.scoreChangeAlerts ?? true,
      macroAlerts: body.macroAlerts ?? true,
      weeklyReport: body.weeklyReport ?? true,
    },
    update: updateData,
  });

  return NextResponse.json(prefs);
}
