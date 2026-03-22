import { NextRequest, NextResponse } from "next/server";
import { trackSignalOutcomes } from "@/lib/cron/track-signals";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await trackSignalOutcomes();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Signal tracking failed:", error);
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }
}
