import type { StockAnalysisInput } from "./types";

export function buildAnalysisPrompt(input: StockAnalysisInput): string {
  const priceStr = input.price != null ? `₺${input.price.toFixed(2)}` : "Veri yok";
  const changeStr =
    input.changePercent != null
      ? `%${input.changePercent.toFixed(2)}`
      : "Veri yok";
  const volumeStr = input.volume != null ? input.volume.toLocaleString("tr-TR") : "Veri yok";

  const newsSection =
    input.newsHeadlines.length > 0
      ? input.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "Güncel haber bulunamadı.";

  return `Sen bir Türk borsası (BİST) uzman analistisin.
Aşağıdaki verilere dayanarak ${input.stockCode} hissesi için günlük analiz yaz.

Tarih: ${input.date}
Kapanış Fiyatı: ${priceStr}
Değişim: ${changeStr}
Hacim: ${volumeStr}

Güncel Haberler:
${newsSection}

Kurallar:
- Tam 3 paragraf yaz:
  1. Genel Durum: Hissenin bugünkü performansını özetle.
  2. Haber Etkisi: Haberlerin hisse üzerindeki olası etkisini değerlendir.
  3. Teknik Görünüm: Genel piyasa duyarlılığını belirt.
- Türkçe yaz, profesyonel ve sade bir dil kullan.
- Kesinlikle yatırım tavsiyesi verme.
- "Bu analiz yatırım danışmanlığı kapsamında değildir" ifadesini kullanma, bu ayrıca ekleniyor.

Ayrıca genel duyarlılığı belirle: POSITIVE, NEGATIVE veya NEUTRAL.

Yanıtını kesinlikle şu JSON formatında ver, başka hiçbir şey ekleme:
{"summaryText": "...", "sentimentScore": "POSITIVE|NEGATIVE|NEUTRAL"}`;
}
