import type { StockAnalysisInput } from "./types";

function formatTechnicals(input: StockAnalysisInput): string {
  const t = input.technicals;
  if (!t) return "Teknik veri mevcut değil.";

  const lines: string[] = [];

  // RSI
  if (t.rsi14 != null) {
    const rsiLabel =
      t.rsiSignal === "OVERBOUGHT"
        ? "AŞIRI ALIM bölgesi (dikkat!)"
        : t.rsiSignal === "OVERSOLD"
          ? "AŞIRI SATIM bölgesi (fırsat olabilir)"
          : "normal aralıkta";
    lines.push(`- RSI(14): ${t.rsi14} → ${rsiLabel}`);
  }

  // MA
  if (t.ma20 != null) lines.push(`- 20 Günlük Ortalama: ₺${t.ma20}`);
  if (t.ma50 != null) lines.push(`- 50 Günlük Ortalama: ₺${t.ma50}`);
  if (t.ma200 != null) lines.push(`- 200 Günlük Ortalama: ₺${t.ma200}`);

  // Golden/Death Cross
  if (t.crossSignal === "GOLDEN_CROSS") {
    lines.push(
      "- ⚡ ALTIN KESİŞİM (Golden Cross): 50 günlük ortalama 200 günlüğü yukarı kesti — güçlü yükseliş sinyali!"
    );
  } else if (t.crossSignal === "DEATH_CROSS") {
    lines.push(
      "- ⚠️ ÖLÜM KESİŞİMİ (Death Cross): 50 günlük ortalama 200 günlüğü aşağı kesti — düşüş sinyali!"
    );
  }

  // Destek / Direnç
  if (t.support != null && t.resistance != null) {
    lines.push(
      `- Destek Seviyesi: ₺${t.support} | Direnç Seviyesi: ₺${t.resistance}`
    );
  }
  if (t.breakoutSignal === "RESISTANCE_BREAK") {
    lines.push(
      "- 🚀 DİRENÇ KIRILIMI: Fiyat son 30 günün en yüksek seviyesini aştı!"
    );
  } else if (t.breakoutSignal === "SUPPORT_BREAK") {
    lines.push(
      "- 🔻 DESTEK KIRILIMI: Fiyat son 30 günün en düşük seviyesinin altına indi!"
    );
  }

  // Hacim Anomalisi
  if (t.volumeRatio != null && t.volumeAvg20 != null) {
    lines.push(
      `- Hacim: 20 gün ortalamasının ${t.volumeRatio.toFixed(1)}x katı`
    );
    if (t.volumeAnomaly) {
      lines.push(
        "- 🔥 HACİM ANOMALİSİ: Normalin 3 katından fazla işlem hacmi — kurumsal hareketlilik olabilir!"
      );
    }
  }

  return lines.join("\n");
}

export function buildAnalysisPrompt(input: StockAnalysisInput): string {
  const priceStr =
    input.price != null ? `₺${input.price.toFixed(2)}` : "Veri yok";
  const changeStr =
    input.changePercent != null
      ? `%${input.changePercent.toFixed(2)}`
      : "Veri yok";
  const volumeStr =
    input.volume != null
      ? input.volume.toLocaleString("tr-TR")
      : "Veri yok";

  const newsSection =
    input.newsHeadlines.length > 0
      ? input.newsHeadlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "Güncel haber bulunamadı.";

  const techSection = formatTechnicals(input);

  return `Sen deneyimli bir Türk borsası (BİST) analistisin. ${input.stockCode} hissesi için profesyonel bir günlük analiz raporu hazırla.

FİYAT VERİLERİ:
- Tarih: ${input.date}
- Kapanış Fiyatı: ${priceStr}
- Günlük Değişim: ${changeStr}
- İşlem Hacmi: ${volumeStr}

TEKNİK GÖSTERGELER (matematiksel olarak hesaplanmıştır, kesin verilerdir):
${techSection}

GÜNCEL HABERLER:
${newsSection}

YAZIM KURALLARI:
1. Tam 4 ayrı paragraf yaz, paragraflar arasında çift satır boşluğu bırak (\\n\\n ile ayır).

2. Paragraf 1 - Günün Özeti: Fiyat, değişim ve hacmi yorumla. Eğer hacim anomalisi varsa bunu vurgula.

3. Paragraf 2 - Teknik Görünüm: RSI, hareketli ortalamalar, destek/direnç seviyelerini TÜRKÇE ve ANLAŞILIR şekilde açıkla. Teknik jargon kullanma, herkesin anlayacağı dilde yaz. Örnek: "RSI 25'e düştü, yani hisse son günlerde gereğinden fazla satıldı, tepki yükselişi gelebilir." Eğer Golden Cross, Death Cross, direnç kırılımı veya hacim anomalisi varsa bunu özellikle vurgula.

4. Paragraf 3 - Haber ve Gelişmeler: Haberlerdeki önemli gelişmeleri analiz et ve hisse üzerindeki olası etkisini değerlendir.

5. Paragraf 4 - Genel Değerlendirme: Tüm verileri bir araya getirip kısa ve net bir genel duyarlılık özeti yap.

- Türkçe yaz, sade ve akıcı dil kullan. Teknik jargonu açıkla.
- Her paragraf en az 2-3 cümle olsun.
- Kesinlikle "al", "sat", "tut" gibi yatırım tavsiyesi verme.
- "Yatırım danışmanlığı kapsamında değildir" YAZMA, bu ayrıca ekleniyor.

DUYARLILIK: POSITIVE, NEGATIVE veya NEUTRAL.

Yanıtını kesinlikle aşağıdaki JSON formatında ver, başka hiçbir şey ekleme:
{"summaryText": "Paragraf 1...\\n\\nParagraf 2...\\n\\nParagraf 3...\\n\\nParagraf 4...", "sentimentScore": "POSITIVE|NEGATIVE|NEUTRAL"}`;
}
