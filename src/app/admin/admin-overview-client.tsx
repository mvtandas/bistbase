"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Briefcase,
  TrendingUp,
  Crown,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface CronLogEntry {
  id: string;
  cronName: string;
  status: string;
  duration: number | null;
  startedAt: string;
  endedAt: string | null;
}

interface Stats {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  premiumUsers: number;
  totalPortfolios: number;
  uniqueStocks: number;
  recentCrons: CronLogEntry[];
}

export function AdminOverviewClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    { label: "Toplam Kullanıcı", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Bugün Yeni", value: stats.newToday, icon: UserPlus, color: "text-green-400" },
    { label: "Bu Hafta Yeni", value: stats.newThisWeek, icon: TrendingUp, color: "text-cyan-400" },
    { label: "Premium", value: stats.premiumUsers, icon: Crown, color: "text-amber-400" },
    { label: "Toplam Portföy", value: stats.totalPortfolios, icon: Briefcase, color: "text-purple-400" },
    { label: "Takip Edilen Hisse", value: stats.uniqueStocks, icon: BarChart3, color: "text-indigo-400" },
  ];

  // Group crons by name, show latest per cron
  const latestCrons = new Map<string, CronLogEntry>();
  for (const log of stats.recentCrons) {
    if (!latestCrons.has(log.cronName)) {
      latestCrons.set(log.cronName, log);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sistem durumu ve temel metrikler
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums text-foreground">
              {card.value.toLocaleString("tr-TR")}
            </p>
          </div>
        ))}
      </div>

      {/* Recent cron status */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Son Cron Durumları
        </h2>
        {latestCrons.size === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz cron kaydı yok.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from(latestCrons.entries()).map(([name, log]) => (
              <div
                key={name}
                className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {name}
                  </span>
                  {log.status === "SUCCESS" && (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  )}
                  {log.status === "FAILED" && (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  {log.status === "RUNNING" && (
                    <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    {new Date(log.startedAt).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {log.duration != null && (
                    <p>{(log.duration / 1000).toFixed(1)}s</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
