"use client";

import { useState } from "react";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { PortfolioEditModal } from "@/components/dashboard/portfolio-edit-modal";

export function DashboardClient() {
  const [editStock, setEditStock] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4">
        <HoldingsTable onEdit={setEditStock} />
      </div>

      {editStock && (
        <PortfolioEditModal
          stockCode={editStock}
          onClose={() => setEditStock(null)}
        />
      )}
    </>
  );
}
