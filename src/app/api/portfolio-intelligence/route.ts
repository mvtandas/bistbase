/**
 * Backward-compatible wrapper: merges core + analytics + simulations from cache.
 * If cache is empty, delegates to the core endpoint logic and pre-computes the rest in background.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheGet, cacheSet, cacheGetSWR } from "@/lib/redis";

export const maxDuration = 120;

type Timeframe = "daily" | "weekly" | "monthly";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const timeframe = (req.nextUrl.searchParams.get("timeframe") ?? "daily") as Timeframe;

  // Check legacy full cache first (set by old endpoint or by this wrapper)
  const legacyCacheKey = `portfolio:${userId}:${timeframe}`;
  const legacyCached = await cacheGet<Record<string, unknown>>(legacyCacheKey);
  if (legacyCached) {
    return NextResponse.json(legacyCached);
  }

  // Try to merge all three tiers from their individual caches
  const [core, analytics, simulations] = await Promise.all([
    cacheGet<Record<string, unknown>>(`portfolio-core:${userId}:${timeframe}`),
    cacheGet<Record<string, unknown>>(`portfolio-analytics:${userId}:${timeframe}`),
    cacheGet<Record<string, unknown>>(`portfolio-simulations:${userId}:${timeframe}`),
  ]);

  if (core) {
    // Merge what's available and return
    const merged = {
      ...core,
      ...(analytics ?? {}),
      ...(simulations ?? {}),
      timeframe,
    };

    // Cache the merged result as legacy key for subsequent reads
    await cacheSet(legacyCacheKey, merged, 300);
    return NextResponse.json(merged);
  }

  // Nothing cached — redirect to core endpoint which handles full computation + background pre-compute
  const coreUrl = new URL(req.url);
  coreUrl.pathname = coreUrl.pathname.replace(/\/portfolio-intelligence$/, "/portfolio-intelligence/core");
  const coreResponse = await fetch(coreUrl.toString(), {
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (!coreResponse.ok) {
    return NextResponse.json(
      await coreResponse.json().catch(() => ({ error: "Portföy analizi başarısız" })),
      { status: coreResponse.status },
    );
  }

  const coreData = await coreResponse.json();

  // Set legacy cache so AI endpoints and other consumers can access it
  await cacheSet(legacyCacheKey, coreData, 300);

  return NextResponse.json(coreData);
}
