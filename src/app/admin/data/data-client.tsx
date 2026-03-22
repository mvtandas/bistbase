"use client";

import { useEffect, useState } from "react";
import { Database, Trash2, Loader2, RefreshCw } from "lucide-react";

interface TableStat {
  name: string;
  count: number;
}

const CACHE_TYPES = [
  { type: "ai-insights", label: "AI Insights", description: "Yapay zeka analiz cache'leri" },
  { type: "screener", label: "Screener Snapshots", description: "Tarama sonuç cache'leri" },
  { type: "technical", label: "Technical Snapshots", description: "Teknik gösterge cache'leri" },
  { type: "cron-logs", label: "Cron Logs", description: "Cron çalışma kayıtları" },
];

export function DataClient() {
  const [tables, setTables] = useState<TableStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearBefore, setClearBefore] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/data/stats");
    const data = await res.json();
    setTables(data.tables);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const clearCache = async (type: string) => {
    const label = CACHE_TYPES.find((c) => c.type === type)?.label || type;
    if (!confirm(`${label} cache'ini temizlemek istediğinize emin misiniz?`)) return;

    setClearing(type);
    const body: Record<string, string> = { type };
    if (clearBefore) body.before = clearBefore;

    const res = await fetch("/api/admin/data/cache", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    alert(`${data.deleted} kayıt silindi.`);
    setClearing(null);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalRecords = tables.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veri Yönetimi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Toplam {totalRecords.toLocaleString("tr-TR")} kayıt
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="p-2 rounded-lg border border-border/25 hover:bg-card/20 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Veritabanı İstatistikleri</h2>
        <div className="rounded-xl border border-border/25 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/25 bg-card/10">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tablo</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Kayıt Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.name} className="border-b border-border/10">
                  <td className="px-4 py-3 text-foreground flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    {table.name}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground tabular-nums">
                    {table.count.toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cache clearing */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Cache Temizleme</h2>

        <div className="mb-4">
          <label className="text-sm text-muted-foreground block mb-1">
            Tarih öncesi sil (opsiyonel)
          </label>
          <input
            type="date"
            value={clearBefore}
            onChange={(e) => setClearBefore(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground focus:outline-none"
          />
          {clearBefore && (
            <button
              onClick={() => setClearBefore("")}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Temizle
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CACHE_TYPES.map((cache) => (
            <div
              key={cache.type}
              className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4 space-y-3"
            >
              <div>
                <h3 className="text-sm font-medium text-foreground">{cache.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{cache.description}</p>
              </div>
              <button
                onClick={() => clearCache(cache.type)}
                disabled={clearing === cache.type}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {clearing === cache.type ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {clearing === cache.type ? "Temizleniyor..." : "Temizle"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
