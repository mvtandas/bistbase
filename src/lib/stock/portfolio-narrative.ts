/**
 * Bistbase AI Portfolio Narrative
 * Portföy verilerinden Türkçe AI anlatı üretimi
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// 30 dakikalık cache
const narrativeCache = new Map<string, { text: string; at: number }>();
const CACHE_TTL = 30 * 60 * 1000;

export interface NarrativeInput {
  totalValue: number | null;
  totalPnL: number | null;
  totalPnLPercent: number | null;
  dailyChange: number;
  verdictAction: string;
  verdictConfidence: number;
  compositeScore: number;
  holdingCount: number;
  alpha: number | null;
  sharpeRatio: number | null;
  diversificationScore: number;
  healthGrade: string;
  strongestHolding: { code: string; reason: string } | null;
  weakestHolding: { code: string; reason: string } | null;
  suggestions: { type: string; message: string }[];
  maxDrawdown: number | null;
}

function buildNarrativePrompt(input: NarrativeInput): string {
  return `Sen bir Türk borsası (BİST) portföy analisti uzmanısın. Aşağıdaki portföy verilerine dayanarak 3-4 cümlelik kısa, net ve aksiyona yönelik Türkçe bir özet yaz. Resmi ama anlaşılır bir dil kullan. Sadece düz metin döndür, JSON formatı kullanma.

Portföy Verileri:
- Toplam Değer: ${input.totalValue != null ? `₺${input.totalValue.toLocaleString("tr-TR")}` : "Bilinmiyor"}
- Toplam K/Z: ${input.totalPnL != null ? `₺${input.totalPnL.toLocaleString("tr-TR")} (%${input.totalPnLPercent})` : "Bilinmiyor"}
- Günlük Değişim: %${input.dailyChange}
- AI Karar: ${input.verdictAction} (%${input.verdictConfidence} güven)
- Bileşik Skor: ${input.compositeScore}/100
- Hisse Sayısı: ${input.holdingCount}
- BİST100'e Göre Alpha: ${input.alpha != null ? `%${input.alpha}` : "Hesaplanamadı"}
- Sharpe Oranı: ${input.sharpeRatio ?? "Hesaplanamadı"}
- Çeşitlendirme Skoru: ${input.diversificationScore}/100
- Sağlık Notu: ${input.healthGrade}
- En Güçlü Hisse: ${input.strongestHolding ? `${input.strongestHolding.code} (${input.strongestHolding.reason})` : "-"}
- En Zayıf Hisse: ${input.weakestHolding ? `${input.weakestHolding.code} (${input.weakestHolding.reason})` : "-"}
- Max Drawdown: ${input.maxDrawdown != null ? `%${input.maxDrawdown}` : "-"}
- Uyarılar: ${input.suggestions.length > 0 ? input.suggestions.map(s => s.message).join("; ") : "Yok"}

Kurallar:
- Sadece 3-4 cümle yaz, fazla uzatma
- İlk cümle: Genel portföy durumu ve karar
- İkinci cümle: Performans sürücüleri (hangi hisseler etkiledi)
- Üçüncü cümle: Risk gözlemi
- Dördüncü cümle: Bir aksiyonel öneri
- Rakamları doğal şekilde cümle içine yerleştir
- Düz metin döndür, başlık veya madde işareti kullanma`;
}

export async function generatePortfolioNarrative(
  input: NarrativeInput,
  userId: string,
): Promise<string | null> {
  const cacheKey = userId;
  const cached = narrativeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.text;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: buildNarrativePrompt(input) }],
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? null;

    if (text) {
      narrativeCache.set(cacheKey, { text, at: Date.now() });
    }

    return text;
  } catch {
    return null;
  }
}
