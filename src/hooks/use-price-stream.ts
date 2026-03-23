"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface PriceData {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  volume: number | null;
}

interface SSEMessage {
  type: "prices" | "update" | "status" | "reconnect" | "error";
  data?: Record<string, PriceData>;
  message?: string;
}

/**
 * SSE ile fiyat stream'i dinler, React Query cache'ini günceller.
 * Piyasa açıkken otomatik bağlanır, kapanınca durur.
 * Bağlantı koparsa otomatik reconnect yapar.
 */
export function usePriceStream() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/stream/prices");
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg: SSEMessage = JSON.parse(event.data);

        if (msg.type === "prices" || msg.type === "update") {
          if (msg.data) {
            // React Query cache güncelle — market-overview ve portfolio verilerini invalidate et
            queryClient.setQueryData(["stream-prices"], (prev: Record<string, PriceData> | undefined) => {
              return { ...prev, ...msg.data };
            });

            // İlgili query'leri invalidate et
            queryClient.invalidateQueries({ queryKey: ["market-overview"], exact: false });
          }
        } else if (msg.type === "reconnect") {
          // Sunucu timeout — yeniden bağlan
          es.close();
          reconnectTimeoutRef.current = setTimeout(connect, 1000);
        } else if (msg.type === "status" && msg.message === "market_closed") {
          es.close();
          // Piyasa kapalı — 1 dakika sonra tekrar kontrol et
          reconnectTimeoutRef.current = setTimeout(connect, 60_000);
        }
      } catch {
        // parse hatası — yoksay
      }
    };

    es.onerror = () => {
      es.close();
      // 5 saniye sonra yeniden dene
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
}
