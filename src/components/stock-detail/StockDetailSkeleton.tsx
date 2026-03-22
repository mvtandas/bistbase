"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function StockDetailSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero skeleton */}
      <div className="pb-4 border-b border-border/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3.5 w-36" />
              </div>
            </div>
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-6 w-32 mt-2 rounded-md" />
          </div>
          <Skeleton className="h-16 w-20 rounded-2xl" />
        </div>
        <Skeleton className="h-8 w-full mt-3 rounded opacity-40" />
        <div className="flex items-center gap-0.5 mt-3 p-0.5">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="grid grid-cols-4 gap-1 p-1">
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
        <Skeleton className="h-9 rounded-lg" />
      </div>

      {/* Content cards skeleton */}
      <div className="space-y-4">
        {/* AI Analysis card */}
        <div className="rounded-xl border border-border/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>

        {/* Factor bars card */}
        <div className="rounded-xl border border-border/20 p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-2.5 flex-1 rounded-full" />
              <Skeleton className="h-3 w-7" />
            </div>
          ))}
        </div>

        {/* Signal card */}
        <div className="rounded-xl border border-border/20 p-4 space-y-3">
          <Skeleton className="h-4 w-36" />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
