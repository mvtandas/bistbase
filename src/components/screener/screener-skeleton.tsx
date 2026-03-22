"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ScreenerSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {/* Best Opportunities */}
      <div className="flex gap-3 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-[220px] flex-shrink-0 rounded-xl" />
        ))}
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Sector Heatmap */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Filters */}
      <Skeleton className="h-8 w-full rounded-lg" />

      {/* Table */}
      <div className="bento-card p-5 space-y-3">
        <Skeleton className="h-10 w-full" />
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground/50 py-4">
        30 hisse analiz ediliyor, bu işlem 30-60 saniye sürebilir...
      </p>
    </div>
  );
}
