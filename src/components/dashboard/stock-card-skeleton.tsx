import { Skeleton } from "@/components/ui/skeleton";

export function StockCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-6 w-20 ml-auto" />
          <Skeleton className="h-3 w-14 ml-auto" />
        </div>
      </div>
      <div className="h-px bg-border/30 mb-4" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-full mt-3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}
