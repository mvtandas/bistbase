"use client";

import { useState } from "react";
import { useUpdateStock } from "@/hooks/use-portfolio-mutations";
import { X } from "lucide-react";

interface PortfolioEditModalProps {
  stockCode: string;
  onClose: () => void;
  mode?: "add" | "edit";
}

export function PortfolioEditModal({ stockCode, onClose, mode = "edit" }: PortfolioEditModalProps) {
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const updateStock = useUpdateStock();

  const isAdd = mode === "add";

  const handleSave = () => {
    if (isAdd && !quantity && !avgCost) {
      // Add mode with no data entered — just close
      onClose();
      return;
    }
    updateStock.mutate(
      {
        stockCode,
        quantity: quantity ? parseFloat(quantity) : 0,
        avgCost: avgCost ? parseFloat(avgCost) : 0,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border/40 rounded-2xl p-5 w-[90%] max-w-sm space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{stockCode} — Pozisyon Bilgisi</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Lot Sayısı</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Örn: 100"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ai-primary"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Ortalama Maliyet (TL)</label>
            <input
              type="number"
              value={avgCost}
              onChange={e => setAvgCost(e.target.value)}
              placeholder="Örn: 285.50"
              step="0.01"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ai-primary"
            />
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground/40">Bu bilgiler opsiyoneldir. Girerseniz ağırlıklı portföy analizi ve kâr/zarar takibi aktif olur.</p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border/40 px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted transition-colors">
            {isAdd ? "Atla" : "Vazgeç"}
          </button>
          <button onClick={handleSave} disabled={updateStock.isPending} className="flex-1 rounded-lg bg-ai-primary text-white px-3 py-2 text-[11px] font-medium hover:bg-ai-primary/90 transition-colors disabled:opacity-50">
            {updateStock.isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
