import { NextRequest, NextResponse } from "next/server";
import { trackVerdictOutcomes } from "@/lib/cron/track-verdicts";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await trackVerdictOutcomes();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Verdict tracking failed:", error);
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }
}
