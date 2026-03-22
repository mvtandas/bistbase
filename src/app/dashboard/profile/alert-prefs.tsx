"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Bell, Mail, Zap, Activity, Globe, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface AlertPrefs {
  morningDigest: boolean;
  signalAlerts: boolean;
  scoreChangeAlerts: boolean;
  macroAlerts: boolean;
  weeklyReport: boolean;
}

const PREF_CONFIG = [
  { key: "morningDigest" as const, icon: Mail, label: "Sabah Bülteni", desc: "Her sabah 08:30'da portföy özeti" },
  { key: "signalAlerts" as const, icon: Zap, label: "Sinyal Alarmları", desc: "Güçlü sinyal tespit edildiğinde" },
  { key: "scoreChangeAlerts" as const, icon: Activity, label: "Skor Değişim", desc: "Skor ±15 puan değiştiğinde" },
  { key: "macroAlerts" as const, icon: Globe, label: "Makro Alarmlar", desc: "USD/TRY %2+, VIX spike" },
  { key: "weeklyReport" as const, icon: BarChart3, label: "Haftalık Rapor", desc: "Her Cuma piyasa özeti" },
];

export function AlertPreferencesForm({ userId, initial }: { userId: string; initial: AlertPrefs }) {
  const [prefs, setPrefs] = useState<AlertPrefs>(initial);
  const [saving, setSaving] = useState(false);

  async function toggle(key: keyof AlertPrefs) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);

    try {
      const res = await fetch("/api/alert-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
      if (res.ok) {
        toast.success("Tercihler güncellendi");
      }
    } catch {
      setPrefs(prefs); // revert
      toast.error("Güncelleme başarısız");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-ai-primary" />
          Alarm Tercihleri
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {PREF_CONFIG.map(({ key, icon: Icon, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            disabled={saving}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
            </div>
            <div className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              prefs[key] ? "bg-ai-primary" : "bg-border"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                prefs[key] ? "translate-x-5" : "translate-x-0.5"
              )} />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
