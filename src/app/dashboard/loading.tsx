import { StockCardSkeleton } from "@/components/dashboard/stock-card-skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-40 bg-secondary rounded animate-pulse" />
        <div className="h-4 w-64 bg-secondary rounded animate-pulse mt-2" />
      </div>
      <div className="space-y-4">
        <StockCardSkeleton />
        <StockCardSkeleton />
      </div>
    </div>
  );
}
