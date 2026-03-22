"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface AiDisclaimerModalProps {
  open: boolean;
  onAccept: () => void;
}

export function AiDisclaimerModal({ open, onAccept }: AiDisclaimerModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await fetch("/api/user/disclaimer", { method: "POST" });
    } catch {
      // silent fail - still close modal
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Analiz Uyarisi</h3>
            <p className="text-[10px] text-muted-foreground">Lutfen dikkatle okuyun</p>
          </div>
        </div>

        <div className="space-y-3 text-[11px] text-muted-foreground leading-relaxed">
          <p>
            Bu platformdaki AI destekli analizler, yapay zeka modelleri tarafindan otomatik olarak uretilmektedir ve <strong className="text-foreground">yatirim tavsiyesi niteliginde degildir</strong>.
          </p>
          <p>
            Giris-cikis noktalari, risk senaryolari, islem kurulumlari ve diger AI onerileri tamamen bilgilendirme amacidir. Gercek yatirim kararlari icin profesyonel danismanlik alinmalidir.
          </p>
          <p>
            AI modelleri yanilabilir, gecmis performans gelecek sonuclarin garantisi degildir. Tum yatirim riskleri kullaniciya aittir.
          </p>
        </div>

        <button
          onClick={handleAccept}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-ai-primary px-4 py-2.5 text-[12px] font-medium text-white hover:bg-ai-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Kaydediliyor..." : "Anliyorum, devam et"}
        </button>
      </div>
    </div>
  );
}
