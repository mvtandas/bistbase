import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface SignalBadgeProps {
  type: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number;
}

const SIGNAL_LABELS: Record<string, string> = {
  // Teknik sinyaller
  GOLDEN_CROSS: "Altın Kesişim",
  DEATH_CROSS: "Ölüm Kesişimi",
  MACD_BULLISH_CROSS: "MACD Boğa",
  MACD_BEARISH_CROSS: "MACD Ayı",
  RSI_OVERSOLD: "RSI Aşırı Satım",
  RSI_OVERBOUGHT: "RSI Aşırı Alım",
  RSI_BULLISH_DIVERGENCE: "RSI Boğa Div.",
  RSI_BEARISH_DIVERGENCE: "RSI Ayı Div.",
  BOLLINGER_SQUEEZE: "BB Sıkışma",
  BB_UPPER_BREAK: "BB Üst Kırılım",
  BB_LOWER_BREAK: "BB Alt Kırılım",
  VOLUME_ANOMALY: "Hacim Anomali",
  MA_STRONG_BULLISH: "MA Güçlü Boğa",
  MA_STRONG_BEARISH: "MA Güçlü Ayı",
  STOCH_OVERSOLD: "Stoch. Aşırı Satım",
  STOCH_OVERBOUGHT: "Stoch. Aşırı Alım",
  STRONG_UPTREND: "Güçlü Yükseliş",
  STRONG_DOWNTREND: "Güçlü Düşüş",
  RESISTANCE_BREAK: "Direnç Kırılımı",
  SUPPORT_BREAK: "Destek Kırılımı",
  OBV_BULLISH_DIVERGENCE: "OBV Boğa Div.",
  OBV_BEARISH_DIVERGENCE: "OBV Ayı Div.",
  CMF_ACCUMULATION: "CMF Para Girişi",
  CMF_DISTRIBUTION: "CMF Para Çıkışı",
  MFI_OVERSOLD: "MFI Aşırı Satım",
  MFI_OVERBOUGHT: "MFI Aşırı Alım",
  TTM_SQUEEZE: "TTM Sıkışma",
  // Mum formasyonları
  CANDLE_DOJI: "Doji",
  CANDLE_GRAVESTONE_DOJI: "Mezar Taşı Doji",
  CANDLE_DRAGONFLY_DOJI: "Yusufçuk Doji",
  CANDLE_HAMMER: "Çekiç",
  CANDLE_HANGING_MAN: "Asılan Adam",
  CANDLE_SHOOTING_STAR: "Kayan Yıldız",
  CANDLE_INVERTED_HAMMER: "Ters Çekiç",
  CANDLE_BULLISH_MARUBOZU: "Boğa Marubozu",
  CANDLE_BEARISH_MARUBOZU: "Ayı Marubozu",
  CANDLE_BULLISH_ENGULFING: "Boğa Yutma",
  CANDLE_BEARISH_ENGULFING: "Ayı Yutma",
  CANDLE_BULLISH_HARAMI: "Boğa Harami",
  CANDLE_BEARISH_HARAMI: "Ayı Harami",
  CANDLE_PIERCING_LINE: "Delici Çizgi",
  CANDLE_DARK_CLOUD: "Kara Bulut",
  CANDLE_TWEEZER_TOP: "Cımbız Tepe",
  CANDLE_TWEEZER_BOTTOM: "Cımbız Dip",
  CANDLE_MORNING_STAR: "Sabah Yıldızı",
  CANDLE_EVENING_STAR: "Akşam Yıldızı",
  CANDLE_THREE_WHITE_SOLDIERS: "Üç Beyaz Asker",
  CANDLE_THREE_BLACK_CROWS: "Üç Kara Karga",
  CANDLE_THREE_INSIDE_UP: "Üçlü İç Yükseliş",
  CANDLE_THREE_INSIDE_DOWN: "Üçlü İç Düşüş",
  // Grafik formasyonları
  CHART_DOUBLE_TOP: "İkili Tepe",
  CHART_DOUBLE_BOTTOM: "İkili Dip",
  CHART_HEAD_SHOULDERS: "Omuz-Baş-Omuz",
  CHART_INVERSE_HEAD_SHOULDERS: "Ters OBO",
  CHART_ASCENDING_TRIANGLE: "Yükselen Üçgen",
  CHART_DESCENDING_TRIANGLE: "Düşen Üçgen",
  // Sinyal zincirleri
  CHAIN_BREAKOUT: "Kırılım Zinciri",
  CHAIN_ACCUMULATION: "Birikim Zinciri",
  CHAIN_DISTRIBUTION: "Dağıtım Zinciri",
  CHAIN_TREND_REVERSAL: "Trend Dönüşü",
};

export function SignalBadge({ type, direction, strength }: SignalBadgeProps) {
  const isBullish = direction === "BULLISH";
  const isNeutral = direction === "NEUTRAL";
  const label = SIGNAL_LABELS[type] ?? type;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium border",
        isNeutral
          ? "bg-muted/50 text-muted-foreground border-muted-foreground/15"
          : isBullish
            ? "bg-gain/5 text-gain border-gain/15"
            : "bg-loss/5 text-loss border-loss/15"
      )}
    >
      {isNeutral ? (
        <Minus className="h-2.5 w-2.5" />
      ) : isBullish ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {label}
      <span className="opacity-50">({strength})</span>
    </div>
  );
}
