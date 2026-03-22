import type { FullTechnicalData } from "@/lib/stock/technicals";
import type { CompositeScore } from "@/lib/stock/scoring";
import type { DetectedSignal } from "@/lib/stock/signals";
import type { FundamentalData, FundamentalScore } from "@/lib/stock/fundamentals";
import type { MacroData } from "@/lib/stock/macro";
import type { RiskMetrics } from "@/lib/stock/risk";
import type { CandlestickPattern } from "@/lib/stock/candlesticks";
import type { ChartPattern } from "@/lib/stock/chart-patterns";
import type { ExtraIndicators } from "@/lib/stock/extra-indicators";
import type { SignalChain } from "@/lib/stock/signal-chains";
import type { CombinationAnalysis } from "@/lib/stock/signal-combinations";
import type { TimeframeAnalysis } from "@/lib/stock/multi-timeframe";
import type { SeasonalityData } from "@/lib/stock/seasonality";
import type { SectorContext } from "@/lib/stock/sectors";
import type { PeerComparison } from "@/lib/stock/peers";
import type { BacktestResult } from "@/lib/stock/backtest";

function fmt(v: number | null | undefined, d = 2): string {
  return v != null ? v.toFixed(d) : "—";
}

// ═══════════════════════════════════════════════════════════
// 1. AKILLI OZET
// ═══════════════════════════════════════════════════════════

export interface AkilliOzetInput {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  compositeScore: CompositeScore | null;
  signals: DetectedSignal[];
  riskMetrics: RiskMetrics | null;
  macroData: MacroData | null;
  seasonality: SeasonalityData | null;
  fundamentalScore: FundamentalScore | null;
}

export function buildAkilliOzetPrompt(input: AkilliOzetInput): { system: string; user: string } {
  const s = input.compositeScore;
  const topSignals = input.signals.slice(0, 3).map(sig => `${sig.description} (${sig.direction}, güç: ${sig.strength})`).join("; ");
  const riskLevel = input.riskMetrics?.riskLevelTr ?? "—";
  const macroScore = input.macroData?.macroScore ?? "—";
  const season = input.seasonality?.seasonalLabel ?? "—";
  const fundScore = input.fundamentalScore?.fundamentalScore ?? "—";

  return {
    system: `Sen kıdemli BİST analistisin. SADECE JSON döndür, başka metin yazma. Türkçe yaz.
KURAL: Sadece verideki sayılara dayanarak yorum yap. Tahmin/spekülasyon yapma.`,
    user: `${input.stockCode} | ₺${fmt(input.price)} | %${fmt(input.changePercent)}

SKOR: ${s?.composite ?? "—"}/100 (${s?.labelTr ?? "—"}) | Teknik ${s?.technical ?? "—"} | Momentum ${s?.momentum ?? "—"} | Hacim ${s?.volume ?? "—"} | Temel ${fundScore} | Makro ${macroScore} | Volatilite ${s?.volatility ?? "—"}
Risk: ${riskLevel} | Mevsim: ${season}
Sinyaller: ${topSignals || "Yok"}

ÇIKTI FORMATI (bu yapıya uy):
{"tldr":"Tek cümle özet max 30 kelime","bullets":[{"icon":"🟢","text":"RSI 42 ile nötr bölgede","category":"technical"},{"icon":"🔴","text":"F/K 18.5 sektör ortalaması üstünde","category":"fundamental"}],"timeHorizon":{"shortTerm":"1-5 gün: ...","mediumTerm":"1-4 hafta: ...","longTerm":"1-3 ay: ..."},"watchlist":["RSI 70 geçerse...","Destek ₺X kırılırsa..."]}

bullets: 5-6 madde, category: "technical"/"fundamental"/"macro"/"risk"
icon: 🟢 olumlu, 🔴 olumsuz, 🟡 nötr
watchlist: 2-3 somut tetikleyici

JSON:`,
  };
}

// ═══════════════════════════════════════════════════════════
// 2. GİRİŞ-ÇIKIŞ NOKTALARI
// ═══════════════════════════════════════════════════════════

export interface GirisCikisInput {
  stockCode: string;
  price: number | null;
  technicals: FullTechnicalData | null;
  extraIndicators: ExtraIndicators | null;
}

export function buildGirisCikisPrompt(input: GirisCikisInput): { system: string; user: string } {
  const t = input.technicals;
  const e = input.extraIndicators;

  const levels: string[] = [];
  if (t?.support != null) levels.push(`Destek: ₺${t.support} | Direnç: ₺${t.resistance}`);
  if (t?.fibonacci) {
    const fb = t.fibonacci;
    levels.push(`Fibonacci: Zirve ₺${fb.swingHigh} | Dip ₺${fb.swingLow}`);
    if (fb.levels) levels.push(`Fib seviyeleri: ${fb.levels.map((l: { level: number; price: number }) => `%${(l.level * 100).toFixed(1)}=₺${l.price.toFixed(2)}`).join(", ")}`);
  }
  if (t?.ichimoku) {
    const ic = t.ichimoku;
    levels.push(`Ichimoku: Tenkan ₺${ic.tenkan} | Kijun ₺${ic.kijun} | Bulut ₺${ic.cloudBottom}-₺${ic.cloudTop}`);
  }
  if (t?.bbUpper != null) levels.push(`Bollinger: ₺${fmt(t.bbLower)}-₺${fmt(t.bbUpper)} | %B: ${fmt(t.bbPercentB)}`);
  if (t?.atr14 != null) levels.push(`ATR(14): ₺${t.atr14}`);
  if (e?.vwap != null) levels.push(`VWAP: ₺${e.vwap}`);
  if (e?.parabolicSar != null) levels.push(`Parabolic SAR: ₺${e.parabolicSar} (${e.sarTrend})`);
  if (e?.supertrend != null) levels.push(`Supertrend: ₺${e.supertrend} (${e.supertrendDirection === "BULLISH" ? "YÜKSELİŞ" : "DÜŞÜŞ"})`);
  if (e?.nearestPivot) levels.push(`Pivot: ${e.nearestPivot.level} ₺${e.nearestPivot.price} (${e.nearestPivot.distance > 0 ? "+" : ""}${e.nearestPivot.distance}%)`);
  if (e?.pivotPoints) levels.push(`Pivot S1: ₺${e.pivotPoints.classic.s1} | PP: ₺${e.pivotPoints.classic.pp} | R1: ₺${e.pivotPoints.classic.r1}`);
  if (t?.ma20 != null) levels.push(`MA20: ₺${t.ma20} | MA50: ₺${t.ma50 ?? "—"} | MA200: ₺${t.ma200 ?? "—"}`);

  return {
    system: `Sen teknik analiz uzmanısın. SADECE JSON döndür. Türkçe yaz. Somut ₺ fiyat seviyeleri ver.
KURAL: Her giriş seviyesi en az 2 confluence (örn: Fibonacci + Destek, Pivot + MA) gerektirmeli. Tek indikatöre dayalı seviye önerme.`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)}

TEKNİK SEVİYELER:
${levels.join("\n")}

GÖREV: Giriş-çıkış analizi yap.
1. "entryZones": 1-2 giriş bölgesi. Her biri: {"priceRange": "₺X - ₺Y", "reasoning": "neden", "confluence": ["destek1", "destek2"], "riskReward": "1:X"}
2. "exitTargets": 2-3 çıkış hedefi. {"price": "₺X", "reasoning": "neden", "type": "partial"/"full"}
3. "stopLoss": {"price": "₺X", "reasoning": "neden", "atrBased": "ATR bazlı: ₺X"}
4. "tradeSetupType": "Trend Devam" / "Geri Çekilme Alımı" / "Kırılım" / "Dip Avcılığı" / "Range İşlemi"
5. "setupQuality": "A" (güçlü confluence) / "B" (orta) / "C" (zayıf)

JSON:
{"entryZones":[...],"exitTargets":[...],"stopLoss":{...},"tradeSetupType":"...","setupQuality":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 3. TEKNİK YORUM
// ═══════════════════════════════════════════════════════════

export interface TeknikYorumInput {
  stockCode: string;
  price: number | null;
  candlestickPatterns: CandlestickPattern[];
  chartPatterns: ChartPattern[];
  technicals: FullTechnicalData | null;
  signalChains: SignalChain[];
  signalCombination: CombinationAnalysis | null;
  multiTimeframe: TimeframeAnalysis | null;
}

export function buildTeknikYorumPrompt(input: TeknikYorumInput): { system: string; user: string } {
  const candleStr = input.candlestickPatterns.length > 0
    ? input.candlestickPatterns.map(p => `${p.nameTr} (${p.direction}, güç: ${p.strength}) → ${p.description}`).join("\n")
    : "Mum formasyonu yok";

  const chartStr = input.chartPatterns.length > 0
    ? input.chartPatterns.map(p => `${p.nameTr} (${p.direction}, güç: ${p.strength}) → ${p.description}`).join("\n")
    : "Grafik formasyonu yok";

  const chainStr = input.signalChains.length > 0
    ? input.signalChains.map(c => `${c.nameTr} (${c.direction}, güç: ${c.strength}) → ${c.description}`).join("\n")
    : "Sinyal zinciri yok";

  const t = input.technicals;
  const ichimokuStr = t?.ichimoku
    ? `Ichimoku: Bulut ${t.ichimoku.cloudColor} | Fiyat ${t.ichimoku.priceVsCloud} | TK: ${t.ichimoku.tkCross ?? "—"} | Kumo: ${t.ichimoku.kumoBreakout ?? "—"}`
    : "Ichimoku verisi yok";

  const fibStr = t?.fibonacci
    ? `Fibonacci: En yakın %${((t.fibonacci.nearestLevel?.level ?? 0) * 100).toFixed(0)} = ₺${t.fibonacci.nearestLevel?.price ?? "—"}`
    : "";

  const mtf = input.multiTimeframe;
  const mtfStr = mtf
    ? `Multi-TF: Haftalık ${mtf.weekly.trend} (RSI: ${fmt(mtf.weekly.rsi)}) | Günlük ${mtf.daily.trend} (RSI: ${fmt(mtf.daily.rsi)}) | Uyum: ${mtf.alignmentTr}`
    : "";

  const combo = input.signalCombination;
  const comboStr = combo
    ? `Sinyal Durumu: ${combo.totalBullish} yükseliş, ${combo.totalBearish} düşüş | Confluence: ${combo.confluenceLabel} | Çatışma: ${combo.conflicting ? "EVET" : "Hayır"}`
    : "";

  return {
    system: `Sen grafik formasyonu uzmanısın. SADECE JSON döndür. Türkçe yaz.
KURAL: Sadece verideki somut formasyonları yorumla. Formasyon yoksa patternReliability: "LOW" döndür.`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)}

MUM FORMASYONLARI:
${candleStr}

GRAFİK FORMASYONLARI:
${chartStr}

SİNYAL ZİNCİRLERİ:
${chainStr}

${ichimokuStr}
${fibStr}
${mtfStr}
${comboStr}

GÖREV: Teknik formasyonları yorumla.
1. "patternNarrative": Tespit edilen formasyonlar NEDEN oluşuyor? Fiyat hareketleri bağlamında açıkla (3-4 cümle)
2. "historicalContext": Benzer formasyon kombinasyonlarında tarihsel emsal ne diyor? (2-3 cümle)
3. "confluenceAnalysis": Sinyaller ve formasyonlar uyuşuyor mu, çatışıyor mu? Neden? (2-3 cümle)
4. "keyLevel": En kritik fiyat seviyesi. {"price": sayı, "type": "support"/"resistance"/"fibonacci"/"ichimoku", "significance": "neden önemli"}
5. "patternReliability": "HIGH" / "MEDIUM" / "LOW"
6. "actionableInsight": Tek cümle: trader ne yapmalı?

JSON:
{"patternNarrative":"...","historicalContext":"...","confluenceAnalysis":"...","keyLevel":{...},"patternReliability":"...","actionableInsight":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 4. SİNYAL ÇATIŞMA ÇÖZÜCÜ
// ═══════════════════════════════════════════════════════════

export interface SinyalCozumInput {
  stockCode: string;
  price: number | null;
  signals: DetectedSignal[];
  signalBacktest: BacktestResult | null;
  multiTimeframe: TimeframeAnalysis | null;
  signalCombination: CombinationAnalysis | null;
}

export function buildSinyalCozumPrompt(input: SinyalCozumInput): { system: string; user: string } {
  const bullSignals = input.signals.filter(s => s.direction === "BULLISH");
  const bearSignals = input.signals.filter(s => s.direction === "BEARISH");

  const formatSigs = (sigs: DetectedSignal[]) =>
    sigs.map(s => {
      const perf = input.signalBacktest?.performances?.find(
        (p: { signalType: string }) => p.signalType === s.type
      );
      const winRate = perf ? `WR: %${perf.horizon1D.winRate?.toFixed(0) ?? "—"}` : "";
      return `${s.description} (güç: ${s.strength}) ${winRate}`;
    }).join("\n");

  const mtf = input.multiTimeframe;
  const mtfStr = mtf ? `Multi-TF Uyum: ${mtf.alignmentTr} | Haftalık: ${mtf.weekly.trend} | Günlük: ${mtf.daily.trend}` : "";

  return {
    system: `Sen sinyal analiz uzmanısın. SADECE JSON döndür. Türkçe yaz.
KURAL: Sinyalleri WR (win rate) ve güç değerine göre sırala. WR verisi yoksa güvenme. Düşük örneklem (<10) sinyallerini göz ardı et.`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)}

YÜKSELİŞ SİNYALLERİ (${bullSignals.length}):
${formatSigs(bullSignals) || "Yok"}

DÜŞÜŞ SİNYALLERİ (${bearSignals.length}):
${formatSigs(bearSignals) || "Yok"}

${mtfStr}

GÖREV: Sinyal çatışmasını çöz.
1. "hasConflict": true/false
2. "conflictSummary": Hangi sinyaller çatışıyor? (1-2 cümle)
3. "resolution": Tarihsel doğruluk ve bağlam kullanarak çözüm (3-4 cümle)
4. "dominantSignal": {"name": "sinyal adı", "direction": "BULLISH"/"BEARISH", "whyTrust": "neden güvenilir"}
5. "ignoredSignals": [{"name": "sinyal", "whyIgnore": "neden göz ardı edilmeli"}]
6. "netConclusion": Tek cümle: ne yapılmalı?
7. "confidenceInResolution": "HIGH" / "MEDIUM" / "LOW"

JSON:
{"hasConflict":true,"conflictSummary":"...","resolution":"...","dominantSignal":{...},"ignoredSignals":[...],"netConclusion":"...","confidenceInResolution":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 5. RİSK SENARYOLARI
// ═══════════════════════════════════════════════════════════

export interface RiskSenaryoInput {
  stockCode: string;
  price: number | null;
  riskMetrics: RiskMetrics | null;
  macroData: MacroData | null;
  fundamentals: FundamentalData | null;
  sectorContext: SectorContext | null;
}

export function buildRiskSenaryoPrompt(input: RiskSenaryoInput): { system: string; user: string } {
  const r = input.riskMetrics;
  const m = input.macroData;
  const f = input.fundamentals;

  const riskLines: string[] = [];
  if (r) {
    riskLines.push(`Risk Seviyesi: ${r.riskLevelTr} | Sharpe: ${fmt(r.sharpeRatio)} | Beta: ${fmt(r.beta)}`);
    riskLines.push(`MaxDD: %${fmt(r.maxDrawdown)} | VaR95 Günlük: %${fmt(r.var95Daily)} | CVaR: %${fmt(r.cvar95Daily)}`);
    riskLines.push(`Yıllık Volatilite: %${fmt(r.annualVolatility)} | Mevcut Drawdown: %${fmt(r.currentDrawdown)}`);
    if (r.stressTests) {
      riskLines.push(`Stres Testleri: ${r.stressTests.map((st: { name: string; estimatedLoss: number }) => `${st.name}: %${fmt(st.estimatedLoss)}`).join(" | ")}`);
    }
  }
  if (m) {
    riskLines.push(`Makro: USD/TRY ₺${fmt(m.usdTry)} (%${fmt(m.usdTryChange)}) | VIX: ${fmt(m.vix)} | DXY: ${fmt(m.dxy)}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ma = m as any;
    if (ma.tcmbPolicyRate != null) riskLines.push(`TCMB Politika Faizi: %${fmt(ma.tcmbPolicyRate, 1)} | Enflasyon (TÜFE): %${fmt(ma.tcmbInflation, 1)} | Reel Faiz: %${fmt(ma.tcmbRealRate, 1)}`);
    if (ma.tcmbReserves != null) riskLines.push(`Döviz Rezervi: $${fmt(ma.tcmbReserves, 1)} milyar`);
  }
  if (f) {
    riskLines.push(`Borç/Özsermaye: ${fmt(f.debtToEquity)} | Cari Oran: ${fmt(f.currentRatio)}`);
  }

  const sectorStr = input.sectorContext ? `Sektör: ${input.sectorContext.sectorName}` : "";

  return {
    system: `Sen risk analizi uzmanısın. SADECE JSON döndür. Türkçe yaz.
KURAL: Senaryoları VaR, MaxDD, Beta ve stres test verilerine dayandır. Olasılıkları somut metriklere göre belirle, tahmin yapma.`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)} | ${sectorStr}

RİSK VERİLERİ:
${riskLines.join("\n")}

GÖREV: 3 gerçekçi risk senaryosu oluştur.
1. "scenarios": 3 senaryo. Her biri:
   - Biri makro şok (döviz/faiz krizi)
   - Biri sektöre özel risk
   - Biri hisseye özel risk
   {"title": "senaryo adı", "probability": "LOW"/"MEDIUM"/"HIGH", "impact": "ne olur (2-3 cümle)", "estimatedLoss": "%-X ile %-Y arası", "hedgeSuggestion": "nasıl korunulur"}
2. "worstCaseNarrative": En kötü durum anlatısı (3-4 cümle)
3. "riskAppetiteAdvice": Bu hisse hangi yatırımcı profili için uygun? (1-2 cümle)
4. "currentRiskSummary": Şu anki risk durumu özeti (2 cümle)

JSON:
{"scenarios":[...],"worstCaseNarrative":"...","riskAppetiteAdvice":"...","currentRiskSummary":"..."}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 6. SEKTÖR KARŞILAŞTIRMA
// ═══════════════════════════════════════════════════════════

export interface SektorAnalizInput {
  stockCode: string;
  price: number | null;
  changePercent: number | null;
  sectorContext: SectorContext | null;
  peerComparison: PeerComparison | null;
  fundamentals: FundamentalData | null;
  fundamentalScore: FundamentalScore | null;
  macroData: MacroData | null;
}

export function buildSektorAnalizPrompt(input: SektorAnalizInput): { system: string; user: string } {
  const sc = input.sectorContext;
  const pc = input.peerComparison;
  const f = input.fundamentals;
  const fs = input.fundamentalScore;

  const peerLines = pc?.peers?.slice(0, 8).map((p: { code: string; price: number | null; changePercent: number | null; peRatio: number | null }) =>
    `${p.code}: ₺${fmt(p.price)} (%${fmt(p.changePercent)}) F/K: ${fmt(p.peRatio, 1)}`
  ).join("\n") ?? "Emsal verisi yok";

  return {
    system: `Sen sektör analisti ve emsal karşılaştırma uzmanısın. SADECE JSON döndür. Türkçe yaz.
KURAL: Karşılaştırmaları F/K, PD/DD, ROE sayılarına dayandır. Rakip verisi eksikse bunu belirt.`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)} | Değişim: %${fmt(input.changePercent)}

SEKTÖR: ${sc?.sectorName ?? "—"} | Sektör Değişim: %${fmt(sc?.sectorChange)} | Göreceli Güç: %${fmt(sc?.relativeStrength)} | ${sc?.outperforming ? "ÜSTÜN PERFORMANS" : "DÜŞÜK PERFORMANS"}

EMSALLER:
${peerLines}
Sıralama: Değişime göre ${pc?.rankByChange ?? "—"}. | F/K'ye göre ${pc?.rankByPE ?? "—"}.

TEMEL: F/K: ${fmt(f?.peRatio, 1)} | ROE: %${fmt(f?.roe)} | Büyüme: %${fmt(f?.revenueGrowth)} | Temel Skor: ${fs?.fundamentalScore ?? "—"}/100

GÖREV: Sektör karşılaştırma analizi yap.
1. "positionSummary": Bu hisse sektörde nerede? (2-3 cümle)
2. "competitiveAdvantage": Rekabet avantajı/dezavantajı (2 cümle)
3. "valuationComparison": Emsallere göre ucuz mu pahalı mı? (2 cümle)
4. "sectorOutlook": Makro koşullar sektörü nasıl etkiliyor? (2 cümle)
5. "betterAlternative": Sektörde daha iyi konumlu hisse varsa kodu ve nedeni, yoksa null

JSON:
{"positionSummary":"...","competitiveAdvantage":"...","valuationComparison":"...","sectorOutlook":"...","betterAlternative":"...veya null"}`,
  };
}

// ═══════════════════════════════════════════════════════════
// 7. İŞLEM KURULUMU
// ═══════════════════════════════════════════════════════════

export interface IslemKurulumuInput {
  stockCode: string;
  price: number | null;
  chartPatterns: ChartPattern[];
  candlestickPatterns: CandlestickPattern[];
  signalChains: SignalChain[];
  technicals: FullTechnicalData | null;
  extraIndicators: ExtraIndicators | null;
  multiTimeframe: TimeframeAnalysis | null;
  signals: DetectedSignal[];
}

export function buildIslemKurulumuPrompt(input: IslemKurulumuInput): { system: string; user: string } {
  const t = input.technicals;
  const e = input.extraIndicators;

  const setupData: string[] = [];

  if (input.chartPatterns.length > 0) {
    setupData.push(`Grafik Formasyonları: ${input.chartPatterns.map(p => `${p.nameTr} (${p.direction}, güç: ${p.strength})`).join("; ")}`);
  }
  if (input.candlestickPatterns.length > 0) {
    setupData.push(`Mum Formasyonları: ${input.candlestickPatterns.map(p => `${p.nameTr} (${p.direction})`).join("; ")}`);
  }
  if (input.signalChains.length > 0) {
    setupData.push(`Sinyal Zincirleri: ${input.signalChains.map(c => `${c.nameTr} (güç: ${c.strength})`).join("; ")}`);
  }
  if (e?.ttmSqueeze) setupData.push(`TTM SQUEEZE AKTİF — Kırılım bekleniyor`);
  if (t?.adx14 != null) setupData.push(`ADX: ${t.adx14} (${t.trendStrength ?? "—"})`);
  if (t?.volumeAnomaly) setupData.push(`HACIM ANOMALİSİ TESPİT EDİLDİ`);
  if (t?.bbSqueeze) setupData.push(`Bollinger SIKIŞMA aktif`);

  const mtf = input.multiTimeframe;
  if (mtf) setupData.push(`Multi-TF: ${mtf.alignmentTr} | Haftalık: ${mtf.weekly.trend}`);

  const activeSignals = input.signals.slice(0, 5).map(s => `${s.description} (${s.direction})`).join("; ");
  if (activeSignals) setupData.push(`Aktif Sinyaller: ${activeSignals}`);

  if (t?.support != null) setupData.push(`Destek: ₺${t.support} | Direnç: ₺${t.resistance}`);
  if (t?.atr14 != null) setupData.push(`ATR: ₺${t.atr14}`);

  return {
    system: `Sen trade setup uzmanısın. SADECE JSON döndür. Türkçe yaz. Setup yoksa setupDetected:false döndür.
KURAL: Setup en az 3 confluence faktörü gerektirmeli. Tek indikatöre dayalı setup önerme. confluenceScore: kaç faktör uyumlu (1-10).`,
    user: `${input.stockCode} | Fiyat: ₺${fmt(input.price)}

SETUP VERİLERİ:
${setupData.join("\n") || "Belirgin setup verisi yok"}

GÖREV: İşlem kurulumu analizi.
Eğer anlamlı bir trade setup oluşuyorsa:
1. "setupDetected": true
2. "setupName": Türkçe setup adı (örn. "Bollinger Sıkışma Kırılımı", "Çift Dip Dönüşü")
3. "setupType": "BREAKOUT" / "REVERSAL" / "TREND_CONTINUATION" / "MEAN_REVERSION"
4. "description": Setup açıklaması (3-4 cümle)
5. "triggerCondition": "₺X seviyesi hacimli kırılırsa aktive olur"
6. "invalidation": "₺Y altına düşerse setup bozulur"
7. "historicalWinRate": Tahmini başarı oranı
8. "timeframe": "Bu setup X gün içinde sonuç verir"
9. "confluenceScore": 1-10 (kaç teknik faktör uyumlu)
10. "status": "ACTIVE" / "PENDING" / "EXPIRED"

Setup yoksa: {"setupDetected":false,"setupName":"","setupType":"BREAKOUT","description":"Şu an belirgin bir işlem kurulumu oluşmamış.","triggerCondition":"","invalidation":"","historicalWinRate":"","timeframe":"","confluenceScore":0,"status":"EXPIRED"}

JSON:
{"setupDetected":...,"setupName":"...","setupType":"...","description":"...","triggerCondition":"...","invalidation":"...","historicalWinRate":"...","timeframe":"...","confluenceScore":...,"status":"..."}`,
  };
}
