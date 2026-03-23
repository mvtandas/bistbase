"use client";

import { usePriceStream } from "@/hooks/use-price-stream";

/**
 * Dashboard'da SSE fiyat stream'ini başlatan invisible bileşen.
 * Layout'a eklenir, herhangi bir UI render etmez.
 */
export function PriceStreamProvider() {
  usePriceStream();
  return null;
}
