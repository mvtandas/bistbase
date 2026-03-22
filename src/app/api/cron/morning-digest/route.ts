import { NextRequest, NextResponse } from "next/server";
import { sendMorningDigests } from "@/lib/cron/morning-digest";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendMorningDigests();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Morning digest failed:", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
