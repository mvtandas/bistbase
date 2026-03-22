"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Plus, Minus, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface WhatIfResult {
  action: string;
  stockCode: string;
  before: { score: number; risk: number; beta: number; verdict: string };
  after: { score: number; risk: number; beta: number; verdict: string };
  delta: { score: number; risk: number; beta: number };
  recommendation: string;
}

export function WhatIfPanel() {
  const [stockCode, setStockCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runWhatIf = async (action: "ADD" | "REMOVE") => {
    if (!stockCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio-intelligence/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, stockCode: stockCode.toUpperCase() }),
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        setError("Simülasyon başarısız oldu. Hisse kodunu kontrol edin.");
      }
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="h-4 w-4 text-ai-primary" />
        <h3 className="text-[12px] font-semibold text-foreground">Ne Olsaydı? Simülasyonu</h3>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={stockCode}
          onChange={e => setStockCode(e.target.value.toUpperCase())}
          placeholder="Hisse kodu (örn: ASELS)"
          className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ai-primary"
        />
        <button onClick={() => runWhatIf("ADD")} disabled={loading || !stockCode} className="flex items-center gap-1 rounded-lg bg-gain/15 border border-gain/20 px-3 py-2 text-[11px] font-medium text-gain hover:bg-gain/25 transition disabled:opacity-40">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Ekle
        </button>
        <button onClick={() => runWhatIf("REMOVE")} disabled={loading || !stockCode} className="flex items-center gap-1 rounded-lg bg-loss/15 border border-loss/20 px-3 py-2 text-[11px] font-medium text-loss hover:bg-loss/25 transition disabled:opacity-40">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />} Çıkar
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Before → After */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div className="rounded-lg bg-card/40 border border-border/20 p-2.5 text-center">
              <div className="text-[9px] text-muted-foreground/40 mb-1">Şu An</div>
              <div className="text-[16px] font-bold tabular-nums text-foreground">{result.before.score}</div>
              <div className="text-[10px] text-muted-foreground/60">{result.before.verdict}</div>
              <div className="text-[9px] text-muted-foreground/40 mt-1">Risk: %{result.before.risk} · Beta: {result.before.beta}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
            <div className="rounded-lg bg-card/40 border border-border/20 p-2.5 text-center">
              <div className="text-[9px] text-muted-foreground/40 mb-1">{result.action === "ADD" ? `+${result.stockCode}` : `-${result.stockCode}`}</div>
              <div className="text-[16px] font-bold tabular-nums text-foreground">{result.after.score}</div>
              <div className="text-[10px] text-muted-foreground/60">{result.after.verdict}</div>
              <div className="text-[9px] text-muted-foreground/40 mt-1">Risk: %{result.after.risk} · Beta: {result.after.beta}</div>
            </div>
          </div>

          {/* Deltas */}
          <div className="flex items-center justify-center gap-4 text-[10px]">
            <span className={cn("font-medium tabular-nums", result.delta.score > 0 ? "text-gain" : result.delta.score < 0 ? "text-loss" : "text-muted-foreground")}>
              Skor: {result.delta.score > 0 ? "+" : ""}{result.delta.score}
            </span>
            <span className={cn("font-medium tabular-nums", result.delta.risk < 0 ? "text-gain" : result.delta.risk > 0 ? "text-loss" : "text-muted-foreground")}>
              Risk: {result.delta.risk > 0 ? "+" : ""}{result.delta.risk}%
            </span>
            <span className={cn("font-medium tabular-nums", Math.abs(result.delta.beta) < 0.05 ? "text-muted-foreground" : result.delta.beta < 0 ? "text-gain" : "text-loss")}>
              Beta: {result.delta.beta > 0 ? "+" : ""}{result.delta.beta}
            </span>
          </div>

          {/* Recommendation */}
          <p className="text-[11px] text-foreground/80 font-medium text-center bg-card/30 rounded-lg p-2 border border-border/10">
            {result.recommendation}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-loss bg-loss/5 border border-loss/15 rounded-lg p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-[10px] text-muted-foreground/40 text-center">
          Bir hisse kodu girin ve "Ekle" veya "Çıkar" butonuna basın.
        </p>
      )}
    </div>
  );
}
