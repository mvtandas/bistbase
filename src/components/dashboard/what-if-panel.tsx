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
    <div className="bento-card animate-slide-up">
      <div className="bento-card-header">
        <Search className="h-4 w-4 text-ai-primary" />
        <span className="bento-card-title">Ne Olsaydı? Simülasyonu</span>
      </div>
      <div className="bento-card-body">
        {/* Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={stockCode}
            onChange={e => setStockCode(e.target.value.toUpperCase())}
            placeholder="Hisse kodu (örn: ASELS)"
            className="flex-1 rounded-xl border border-border/40 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ai-primary"
          />
          <button onClick={() => runWhatIf("ADD")} disabled={loading || !stockCode} className="flex items-center gap-1.5 rounded-xl bg-gain/15 border border-gain/20 px-4 py-2.5 text-xs font-semibold text-gain hover:bg-gain/25 transition disabled:opacity-40">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ekle
          </button>
          <button onClick={() => runWhatIf("REMOVE")} disabled={loading || !stockCode} className="flex items-center gap-1.5 rounded-xl bg-loss/15 border border-loss/20 px-4 py-2.5 text-xs font-semibold text-loss hover:bg-loss/25 transition disabled:opacity-40">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />} Çıkar
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <div className="rounded-xl bg-card/40 border border-border/20 p-3.5 text-center">
                <div className="text-[11px] text-muted-foreground/50 mb-1">Şu An</div>
                <div className="text-xl font-bold tabular-nums text-foreground">{result.before.score}</div>
                <div className="text-xs text-muted-foreground/70">{result.before.verdict}</div>
                <div className="text-[11px] text-muted-foreground/50 mt-1.5">Risk: %{result.before.risk} · Beta: {result.before.beta}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground/30" />
              <div className="rounded-xl bg-card/40 border border-border/20 p-3.5 text-center">
                <div className="text-[11px] text-muted-foreground/50 mb-1">{result.action === "ADD" ? `+${result.stockCode}` : `-${result.stockCode}`}</div>
                <div className="text-xl font-bold tabular-nums text-foreground">{result.after.score}</div>
                <div className="text-xs text-muted-foreground/70">{result.after.verdict}</div>
                <div className="text-[11px] text-muted-foreground/50 mt-1.5">Risk: %{result.after.risk} · Beta: {result.after.beta}</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-5 text-xs">
              <span className={cn("font-semibold tabular-nums", result.delta.score > 0 ? "text-gain" : result.delta.score < 0 ? "text-loss" : "text-muted-foreground")}>
                Skor: {result.delta.score > 0 ? "+" : ""}{result.delta.score}
              </span>
              <span className={cn("font-semibold tabular-nums", result.delta.risk < 0 ? "text-gain" : result.delta.risk > 0 ? "text-loss" : "text-muted-foreground")}>
                Risk: {result.delta.risk > 0 ? "+" : ""}{result.delta.risk}%
              </span>
              <span className={cn("font-semibold tabular-nums", Math.abs(result.delta.beta) < 0.05 ? "text-muted-foreground" : result.delta.beta < 0 ? "text-gain" : "text-loss")}>
                Beta: {result.delta.beta > 0 ? "+" : ""}{result.delta.beta}
              </span>
            </div>

            <p className="text-sm text-foreground/80 font-medium text-center bg-card/30 rounded-xl p-3 border border-border/15">
              {result.recommendation}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-loss bg-loss/5 border border-loss/15 rounded-xl p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!result && !loading && !error && (
          <p className="text-xs text-muted-foreground/50 text-center">
            Bir hisse kodu girin ve "Ekle" veya "Çıkar" butonuna basın.
          </p>
        )}
      </div>
    </div>
  );
}
