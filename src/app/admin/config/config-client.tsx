"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";

const DEFAULT_CONFIGS = [
  { key: "BETA_MODE", label: "Beta Modu", description: "Premium plan kısıtlamalarını devre dışı bırakır", type: "boolean" },
  { key: "SCORE_CHANGE_THRESHOLD", label: "Skor Değişim Eşiği", description: "Skor değişim uyarısı için minimum puan farkı", type: "number" },
  { key: "MACRO_USD_THRESHOLD", label: "USD/TRY Eşiği (%)", description: "Makro uyarı için USD/TRY değişim yüzdesi", type: "number" },
  { key: "MACRO_VIX_THRESHOLD", label: "VIX Eşiği", description: "Makro uyarı için VIX seviyesi", type: "number" },
];

export function ConfigClient() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => {
        setConfigs(data);
        setEditValues(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async (key: string) => {
    setSaving(key);
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: editValues[key] }),
    });
    setConfigs((prev) => ({ ...prev, [key]: editValues[key] }));
    setSaving(null);
  };

  const addConfig = async () => {
    if (!newKey.trim()) return;
    setSaving("new");
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, value: newValue }),
    });
    setConfigs((prev) => ({ ...prev, [newKey]: newValue }));
    setEditValues((prev) => ({ ...prev, [newKey]: newValue }));
    setNewKey("");
    setNewValue("");
    setSaving(null);
  };

  const toggleBoolean = async (key: string) => {
    const current = editValues[key] || configs[key] || "false";
    const newVal = current === "true" ? "false" : "true";
    setEditValues((prev) => ({ ...prev, [key]: newVal }));
    setSaving(key);
    await fetch("/api/admin/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: newVal }),
    });
    setConfigs((prev) => ({ ...prev, [key]: newVal }));
    setSaving(null);
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sistem Ayarları</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uygulama konfigürasyon değerlerini yönetin
        </p>
      </div>

      {/* Predefined configs */}
      <div className="space-y-4">
        {DEFAULT_CONFIGS.map((cfg) => {
          const value = editValues[cfg.key] ?? configs[cfg.key] ?? "";
          const changed = value !== (configs[cfg.key] ?? "");

          return (
            <div
              key={cfg.key}
              className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{cfg.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">{cfg.key}</p>
                </div>

                {cfg.type === "boolean" ? (
                  <button
                    onClick={() => toggleBoolean(cfg.key)}
                    disabled={saving === cfg.key}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      value === "true" ? "bg-green-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        value === "true" ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type={cfg.type === "number" ? "number" : "text"}
                      value={value}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [cfg.key]: e.target.value }))
                      }
                      className="w-24 px-3 py-1.5 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {changed && (
                      <button
                        onClick={() => saveConfig(cfg.key)}
                        disabled={saving === cfg.key}
                        className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        {saving === cfg.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom configs */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Özel Ayarlar</h2>

        {/* Show any configs not in DEFAULT_CONFIGS */}
        {Object.entries(configs)
          .filter(([key]) => !DEFAULT_CONFIGS.some((d) => d.key === key))
          .map(([key, val]) => (
            <div
              key={key}
              className="rounded-xl border border-border/25 bg-card/20 backdrop-blur-sm p-4 mb-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-mono text-foreground">{key}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editValues[key] ?? val}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="w-40 px-3 py-1.5 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground focus:outline-none"
                />
                {(editValues[key] ?? val) !== val && (
                  <button
                    onClick={() => saveConfig(key)}
                    disabled={saving === key}
                    className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

        {/* Add new config */}
        <div className="rounded-xl border border-dashed border-border/40 bg-card/10 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="Anahtar (KEY)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <input
            type="text"
            placeholder="Değer"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={addConfig}
            disabled={!newKey.trim() || saving === "new"}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
          >
            {saving === "new" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
