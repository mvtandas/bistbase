"use client";

import { useState, useEffect } from "react";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { PortfolioEditModal } from "@/components/dashboard/portfolio-edit-modal";
import { StockCommandDialog } from "@/components/dashboard/stock-command-dialog";
import { useRemoveStock } from "@/hooks/use-portfolio-mutations";

export function DashboardClient() {
  const [editStock, setEditStock] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"add" | "edit">("edit");
  const [commandOpen, setCommandOpen] = useState(false);
  const removeStock = useRemoveStock();

  // Global keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleStockAdded = (code: string) => {
    setCommandOpen(false);
    setEditMode("add");
    setEditStock(code);
  };

  const handleEdit = (code: string) => {
    setEditMode("edit");
    setEditStock(code);
  };

  return (
    <>
      <div className="min-w-0 overflow-hidden">
        <HoldingsTable
          onEdit={handleEdit}
          onAdd={() => setCommandOpen(true)}
          onRemove={(code) => removeStock.mutate(code)}
        />
      </div>

      {editStock && (
        <PortfolioEditModal
          stockCode={editStock}
          mode={editMode}
          onClose={() => setEditStock(null)}
        />
      )}

      <StockCommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onStockAdded={handleStockAdded}
      />
    </>
  );
}
