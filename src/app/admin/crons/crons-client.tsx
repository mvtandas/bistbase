"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface CronJob {
  name: string;
  label: string;
  schedule: string;
  lastRun: {
    id: string;
    status: string;
    duration: number | null;
    startedAt: string;
    endedAt: string | null;
    error: string | null;
  } | null;
}

interface CronLogEntry {
  id: string;
  cronName: string;
  status: string;
  duration: number | null;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

export function CronsClient() {
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [logs, setLogs] = useState<CronLogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logFilter, setLogFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const fetchCrons = useCallback(async () => {
    const res = await fetch("/api/admin/crons");
    const data = await res.json();
    setCrons(data);
  }, []);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (logFilter) params.set("cronName", logFilter);
    params.set("page", String(logPage));
    params.set("limit", "20");
    const res = await fetch(`/api/admin/crons/logs?${params}`);
    const data = await res.json();
    setLogs(data.logs);
    setLogsTotal(data.totalPages);
  }, [logFilter, logPage]);

  useEffect(() => {
    Promise.all([fetchCrons(), fetchLogs()]).finally(() => setLoading(false));
  }, [fetchCrons, fetchLogs]);

  const triggerCron = async (name: string) => {
    setTriggering(name);
    try {
      const res = await fetch(`/api/admin/crons/${name}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Hata oluştu");
      }
    } catch {
      alert("İstek gönderilemedi");
    }
    setTriggering(null);
    fetchCrons();
    fetchLogs();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cron İşlemleri</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zamanlanmış görevleri yönetin ve izleyin
          </p>
        </div>
        <button
          onClick={() => { fetchCrons(); fetchLogs(); }}
          className="p-2 rounded-lg border border-border/25 hover:bg-card/20 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Cron cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {crons.map((cron) => (
          <div
            key={cron.name}
            className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">{cron.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{cron.schedule}</p>
              </div>
              {cron.lastRun && (
                <>
                  {cron.lastRun.status === "SUCCESS" && <CheckCircle className="h-4 w-4 text-green-400" />}
                  {cron.lastRun.status === "FAILED" && <XCircle className="h-4 w-4 text-red-400" />}
                  {cron.lastRun.status === "RUNNING" && <Clock className="h-4 w-4 text-amber-400 animate-pulse" />}
                </>
              )}
            </div>

            {cron.lastRun && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>
                  Son çalışma:{" "}
                  {new Date(cron.lastRun.startedAt).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {cron.lastRun.duration != null && (
                  <p>Süre: {(cron.lastRun.duration / 1000).toFixed(1)}s</p>
                )}
                {cron.lastRun.error && (
                  <p className="text-red-400 truncate">{cron.lastRun.error}</p>
                )}
              </div>
            )}

            {!cron.lastRun && (
              <p className="text-xs text-muted-foreground">Henüz çalıştırılmadı</p>
            )}

            <button
              onClick={() => triggerCron(cron.name)}
              disabled={triggering === cron.name}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {triggering === cron.name ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {triggering === cron.name ? "Çalışıyor..." : "Çalıştır"}
            </button>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Çalışma Kayıtları</h2>
          <select
            value={logFilter}
            onChange={(e) => { setLogFilter(e.target.value); setLogPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground focus:outline-none"
          >
            <option value="">Tüm Cronlar</option>
            {crons.map((c) => (
              <option key={c.name} value={c.name}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border/25 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/25 bg-card/10">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cron</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Durum</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Süre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Başlangıç</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Hata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/10">
                  <td className="px-4 py-3 text-foreground">{log.cronName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.status === "SUCCESS"
                        ? "bg-green-400/10 text-green-400"
                        : log.status === "FAILED"
                        ? "bg-red-400/10 text-red-400"
                        : "bg-amber-400/10 text-amber-400"
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.duration != null ? `${(log.duration / 1000).toFixed(1)}s` : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(log.startedAt).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-red-400 text-xs max-w-[200px] truncate">
                    {log.error || "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {logsTotal > 1 && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">Sayfa {logPage} / {logsTotal}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                disabled={logPage === 1}
                className="p-2 rounded-lg border border-border/25 hover:bg-card/20 disabled:opacity-30 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLogPage((p) => Math.min(logsTotal, p + 1))}
                disabled={logPage === logsTotal}
                className="p-2 rounded-lg border border-border/25 hover:bg-card/20 disabled:opacity-30 text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
