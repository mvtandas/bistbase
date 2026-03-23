import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet, cacheSet, cacheGetSWR } from "@/lib/redis";
import { after } from "next/server";
import { computeAnalytics } from "../_lib/compute-analytics";

export const maxDuration = 60;

type Timeframe = "daily" | "weekly" | "monthly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const timeframe = (req.nextUrl.searchParams.get("timeframe") ?? "daily") as Timeframe;
  const analyticsKey = `portfolio-analytics:${userId}:${timeframe}`;

  // SWR cache check
  const swr = await cacheGetSWR<Record<string, unknown>>(analyticsKey, 120);
  if (swr) {
    if (swr.stale) {
      after(async () => {
        try {
          const result = await computeAnalytics(userId, timeframe);
          if (result) await cacheSet(analyticsKey, result, 900);
        } catch (e) {
          console.error("[analytics] background recompute failed:", e);
        }
      });
    }
    return NextResponse.json(swr.data);
  }

  try {
    const result = await computeAnalytics(userId, timeframe);
    if (!result) {
      return NextResponse.json({ error: "Core verisi bulunamadi. Once dashboard'u acin." }, { status: 404 });
    }

    await cacheSet(analyticsKey, result, 900); // 15 min
    return NextResponse.json(result);
  } catch (error) {
    console.error("Portfolio analytics failed:", error);
    return NextResponse.json({ error: "Analytics hesaplanamadı" }, { status: 500 });
  }
}
