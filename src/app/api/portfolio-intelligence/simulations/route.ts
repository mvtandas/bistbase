import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet, cacheSet, cacheGetSWR } from "@/lib/redis";
import { after } from "next/server";
import { computeSimulations } from "../_lib/compute-simulations";

export const maxDuration = 120;

type Timeframe = "daily" | "weekly" | "monthly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const timeframe = (req.nextUrl.searchParams.get("timeframe") ?? "daily") as Timeframe;
  const simsKey = `portfolio-simulations:${userId}:${timeframe}`;

  // SWR cache check
  const swr = await cacheGetSWR<Record<string, unknown>>(simsKey, 180);
  if (swr) {
    if (swr.stale) {
      after(async () => {
        try {
          const result = await computeSimulations(userId, timeframe);
          if (result) await cacheSet(simsKey, result, 1800);
        } catch (e) {
          console.error("[simulations] background recompute failed:", e);
        }
      });
    }
    return NextResponse.json(swr.data);
  }

  try {
    const result = await computeSimulations(userId, timeframe);
    if (!result) {
      return NextResponse.json({ error: "Core verisi bulunamadi. Once dashboard'u acin." }, { status: 404 });
    }

    await cacheSet(simsKey, result, 1800); // 30 min
    return NextResponse.json(result);
  } catch (error) {
    console.error("Portfolio simulations failed:", error);
    return NextResponse.json({ error: "Simülasyonlar hesaplanamadı" }, { status: 500 });
  }
}
