import { NextRequest, NextResponse } from "next/server";
import { sendMacroAlerts } from "@/lib/cron/macro-alerts";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendMacroAlerts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Macro alerts failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
