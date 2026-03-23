import { NextRequest } from "next/server";
import { getBatchQuotes } from "@/lib/stock/yahoo";
import { getMarketState } from "@/lib/stock/market-hours";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby: 60s, Pro: 300s

/**
 * SSE (Server-Sent Events) endpoint — fiyat stream'i.
 * Kullanıcının portföyündeki hisselerin fiyatlarını push eder.
 * Vercel timeout'una yaklaşınca graceful close yapar.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { isOpen } = getMarketState();
  if (!isOpen) {
    return new Response(
      formatSSE({ type: "status", message: "market_closed" }),
      {
        headers: sseHeaders(),
      }
    );
  }

  // Kullanıcının portföy hisselerini al
  const portfolioStocks = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    select: { stockCode: true },
  });
  const codes = portfolioStocks.map((s) => s.stockCode);

  if (codes.length === 0) {
    return new Response(
      formatSSE({ type: "status", message: "no_stocks" }),
      { headers: sseHeaders() }
    );
  }

  // İlk fiyat verisi
  const initialQuotes = await getBatchQuotes(codes);
  const lastPrices = new Map<string, number>();
  for (const [code, q] of initialQuotes) {
    if (q.price) lastPrices.set(code, q.price);
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();
  const maxRuntime = (maxDuration - 5) * 1000; // 5s buffer

  const stream = new ReadableStream({
    async start(controller) {
      // İlk veriyi hemen gönder
      const initialData = Object.fromEntries(initialQuotes);
      controller.enqueue(encoder.encode(formatSSE({ type: "prices", data: initialData })));

      // Her 5 saniyede bir Redis'ten oku, değişiklik varsa push et
      const intervalId = setInterval(async () => {
        try {
          // Timeout kontrolü
          if (Date.now() - startTime > maxRuntime) {
            controller.enqueue(encoder.encode(formatSSE({ type: "reconnect", message: "timeout" })));
            clearInterval(intervalId);
            controller.close();
            return;
          }

          const quotes = await getBatchQuotes(codes);
          const changed: Record<string, unknown> = {};
          let hasChanges = false;

          for (const [code, q] of quotes) {
            const prevPrice = lastPrices.get(code);
            if (q.price && q.price !== prevPrice) {
              changed[code] = q;
              lastPrices.set(code, q.price);
              hasChanges = true;
            }
          }

          if (hasChanges) {
            controller.enqueue(encoder.encode(formatSSE({ type: "update", data: changed })));
          } else {
            // Heartbeat — bağlantıyı canlı tut
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
        } catch (err) {
          console.error("[SSE] Error:", err);
          controller.enqueue(encoder.encode(formatSSE({ type: "error", message: "fetch_failed" })));
        }
      }, 5000);

      // Cleanup on cancel
      req.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Nginx buffering devre dışı
  };
}

function formatSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
