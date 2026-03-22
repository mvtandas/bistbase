"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/constants";
import { toast } from "sonner";

// All portfolio-related query keys to invalidate after mutations
const PORTFOLIO_KEYS = [
  QUERY_KEYS.PORTFOLIO_INTELLIGENCE,
  QUERY_KEYS.PORTFOLIO_RISK,
  QUERY_KEYS.PORTFOLIO_EQUITY_CURVE,
  QUERY_KEYS.PORTFOLIO_HISTORY,
  QUERY_KEYS.PORTFOLIO_MONTE_CARLO,
  QUERY_KEYS.PORTFOLIO_NEWS,
  QUERY_KEYS.PORTFOLIO,
] as const;

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of PORTFOLIO_KEYS) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useAddStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stockCode: string) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw { status: res.status, error: data.error, message: data.message };
      }

      return res.json();
    },

    onMutate: async (stockCode) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE });

      // Snapshot previous value
      const previous = queryClient.getQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE);

      // Optimistically add stub holding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE, (old: any) => {
        if (!old?.holdings) return old;
        // Don't add if already exists
        if (old.holdings.some((h: { stockCode: string }) => h.stockCode === stockCode)) return old;
        return {
          ...old,
          holdings: [
            ...old.holdings,
            {
              stockCode,
              price: null,
              changePercent: null,
              compositeScore: null,
              verdictAction: null,
              verdictScore: null,
              weight: 0,
              quantity: null,
              cost: null,
              value: null,
              pnl: null,
              pnlPercent: null,
              sectorCode: null,
            },
          ],
        };
      });

      return { previous };
    },

    onError: (_err, _stockCode, context) => {
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE, context.previous);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = _err as any;
      if (err?.error === "PREMIUM_REQUIRED") {
        toast.error(err.message || "Ücretsiz planda maksimum 2 hisse takip edebilirsiniz.");
      } else {
        toast.error("Hisse eklenirken bir hata oluştu.");
      }
    },

    onSuccess: (_data, stockCode) => {
      toast.success(`${stockCode} portföye eklendi`);
    },

    onSettled: () => {
      invalidateAll(queryClient);
    },
  });
}

export function useRemoveStock() {
  const queryClient = useQueryClient();
  const addStock = useAddStock();

  return useMutation({
    mutationFn: async (stockCode: string) => {
      const res = await fetch("/api/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode }),
      });

      if (!res.ok) {
        throw new Error("Hisse çıkarılırken bir hata oluştu.");
      }

      return res.json();
    },

    onMutate: async (stockCode) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.PORTFOLIO_INTELLIGENCE });

      const previous = queryClient.getQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE);

      // Optimistically remove
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE, (old: any) => {
        if (!old?.holdings) return old;
        return {
          ...old,
          holdings: old.holdings.filter((h: { stockCode: string }) => h.stockCode !== stockCode),
        };
      });

      return { previous };
    },

    onError: (_err, _stockCode, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEYS.PORTFOLIO_INTELLIGENCE, context.previous);
      }
      toast.error("Hisse çıkarılırken bir hata oluştu.");
    },

    onSuccess: (_data, stockCode) => {
      toast(`${stockCode} portföyden çıkarıldı`, {
        duration: 5000,
        action: {
          label: "Geri Al",
          onClick: () => addStock.mutate(stockCode),
        },
      });
    },

    onSettled: () => {
      invalidateAll(queryClient);
    },
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stockCode, quantity, avgCost }: { stockCode: string; quantity?: number; avgCost?: number }) => {
      const res = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockCode, quantity, avgCost }),
      });

      if (!res.ok) {
        throw new Error("Pozisyon güncellenirken bir hata oluştu.");
      }

      return res.json();
    },

    onSuccess: (_data, { stockCode }) => {
      toast.success(`${stockCode} pozisyonu güncellendi`);
    },

    onError: () => {
      toast.error("Pozisyon güncellenirken bir hata oluştu.");
    },

    onSettled: () => {
      invalidateAll(queryClient);
    },
  });
}
