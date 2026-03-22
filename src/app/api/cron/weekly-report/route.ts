import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/cron/weekly-report";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await generateWeeklyReport();
    if (!report) {
      return NextResponse.json({ error: "Rapor oluşturulamadı" }, { status: 500 });
    }

    // Haftalık raporu weeklyReport açık olan kullanıcılara gönder
    const users = await prisma.user.findMany({
      where: { alertPrefs: { weeklyReport: true } },
      select: { email: true },
    });

    let sent = 0;
    for (const user of users) {
      if (!user.email) continue;
      const success = await sendEmail({
        to: user.email,
        subject: "Bistbase Haftalık Piyasa Raporu",
        html: `<div style="font-family:sans-serif;color:#e0e0e0;background:#1a1a2e;padding:24px;border-radius:12px;">${report.replace(/\n/g, "<br/>")}</div>`,
      });
      if (success) sent++;
    }

    return NextResponse.json({ success: true, sent, totalUsers: users.length });
  } catch (error) {
    console.error("Weekly report failed:", error);
    return NextResponse.json({ error: "Report failed" }, { status: 500 });
  }
}
