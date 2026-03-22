/**
 * Metrik Yorumlama Motoru
 * Değer → Türkçe yorum. AI yok, kural bazlı.
 */

// ═══ FAKTÖR SKORLARI ═══

export function interpretFactor(factor: string, score: number): string {
  const high = score >= 65;
  const mid = score >= 40;
  const map: Record<string, [string, string, string]> = {
    technical: ["Teknik görünüm güçlü — indikatörler yükselişe işaret ediyor", "Teknik görünüm nötr — net yön yok", "Teknik görünüm zayıf — indikatörler düşüş yönünde"],
    momentum: ["Momentum pozitif — fiyat ivme kazanıyor", "Momentum nötr — ivme zayıf", "Momentum negatif — fiyat ivme kaybediyor"],
    volume: ["Güçlü para girişi — hacim ve akıllı para alıcıdan yana", "Hacim nötr — belirgin yön yok", "Para çıkışı var — satış baskısı hakim"],
    fundamental: ["Şirketin finansal sağlığı güçlü", "Finansal durum ortalama", "Finansal durum zayıf — dikkat"],
    macro: ["Makro ortam olumlu — piyasa rüzgarı arkadan", "Makro ortam nötr", "Makro ortam olumsuz — piyasa baskı altında"],
    sentiment: ["Piyasa duyarlılığı pozitif", "Duyarlılık nötr", "Piyasa duyarlılığı negatif"],
    volatility: ["Düşük oynaklık — sakin dönem", "Normal oynaklık", "Yüksek oynaklık — dikkatli ol"],
  };
  const [h, m, l] = map[factor] ?? ["Güçlü", "Nötr", "Zayıf"];
  return high ? h : mid ? m : l;
}

// ═══ TEMEL ANALİZ ═══

export function interpretPE(pe: number | null): string {
  if (pe == null) return "";
  if (pe < 0) return "Zarar eden şirket — F/K negatif";
  if (pe < 5) return "Çok düşük F/K — değer fırsatı veya sorun işareti";
  if (pe < 10) return "Düşük F/K — ucuz değerlenmiş olabilir";
  if (pe < 15) return "Makul F/K — sektör ortalamasına yakın";
  if (pe < 25) return "Yüksek F/K — büyüme primi var veya pahalı";
  return "Çok yüksek F/K — fiyatta aşırı beklenti olabilir";
}

export function interpretROE(roe: number | null): string {
  if (roe == null) return "";
  if (roe < 0) return "Negatif ROE — şirket zarar ediyor";
  if (roe < 8) return "Düşük karlılık — sermaye verimsiz kullanılıyor";
  if (roe < 15) return "Orta karlılık — kabul edilebilir";
  if (roe < 25) return "Güçlü karlılık — sermaye verimli";
  return "Çok güçlü karlılık — üstün performans";
}

export function interpretDebtEquity(de: number | null): string {
  if (de == null) return "";
  if (de < 30) return "Düşük borçluluk — sağlam yapı";
  if (de < 80) return "Orta borçluluk — kabul edilebilir";
  if (de < 150) return "Yüksek borçluluk — faiz artışlarına duyarlı";
  return "Çok yüksek borçluluk — finansal risk";
}

export function interpretCurrentRatio(cr: number | null): string {
  if (cr == null) return "";
  if (cr < 0.8) return "Ciddi likidite riski — borçları karşılayamayabilir";
  if (cr < 1) return "Likidite sıkışık — kısa vade riskli";
  if (cr < 1.5) return "Yeterli likidite — dar marj";
  if (cr < 2.5) return "Güçlü likidite — rahat karşılama";
  return "Çok yüksek likidite — nakit verimli kullanılmıyor olabilir";
}

export function interpretGrowth(g: number | null): string {
  if (g == null) return "";
  if (g > 30) return "Güçlü büyüme — şirket hızla genişliyor";
  if (g > 15) return "Sağlıklı büyüme";
  if (g > 5) return "Ilımlı büyüme";
  if (g > 0) return "Durgun — enflasyonun altında kalıyor olabilir";
  if (g > -10) return "Hafif daralma";
  return "Ciddi daralma — gelirler düşüyor";
}

export function interpretDividend(dy: number | null): string {
  if (dy == null || dy === 0) return "";
  if (dy < 2) return "Düşük temettü";
  if (dy < 5) return "Makul temettü verimi";
  if (dy < 8) return "Yüksek temettü — gelir odaklı için cazip";
  return "Çok yüksek temettü — sürdürülebilirliği kontrol et";
}

// ═══ RİSK ═══

export function interpretSharpe(s: number | null): string {
  if (s == null) return "";
  if (s > 2) return "Mükemmel risk-getiri dengesi";
  if (s > 1) return "İyi risk-getiri — aldığın riske değiyor";
  if (s > 0) return "Kabul edilebilir ama risk karşılığı düşük getiri";
  return "Negatif — mevduattan daha kötü performans";
}

export function interpretMaxDD(dd: number | null, days: number | null): string {
  if (dd == null) return "";
  const d = days ? ` (${days} günde)` : "";
  if (dd < 10) return `Sınırlı düşüş %${dd}${d} — dirençli yapı`;
  if (dd < 20) return `Orta düşüş %${dd}${d}`;
  if (dd < 35) return `Sert düşüş %${dd}${d} — yüksek risk`;
  return `Ciddi çöküş %${dd}${d} — çok riskli`;
}

export function interpretVaR(v: number | null): string {
  if (v == null) return "";
  return `Normal günde en fazla %${v} kayıp beklenir (20 günde 1 gün aşılabilir)`;
}

export function interpretBeta(b: number | null): string {
  if (b == null) return "";
  if (b > 1.5) return "Piyasadan çok daha oynak — agresif";
  if (b > 1) return "Piyasayla benzer ama biraz daha hareketli";
  if (b > 0.5) return "Piyasadan daha sakin — defansif";
  if (b > 0) return "Düşük hassasiyet — bağımsız hareket";
  return "Ters yönde hareket — hedge potansiyeli";
}

// ═══ TEKNİK ═══

export function interpretRSI(rsi: number | null): string {
  if (rsi == null) return "";
  if (rsi <= 25) return "Aşırı satım — çok düştü, teknik toparlanma gelebilir";
  if (rsi <= 30) return "Aşırı satım bölgesinde — potansiyel dip fırsatı";
  if (rsi <= 45) return "Zayıf momentum — satıcılar hâlâ güçlü";
  if (rsi <= 55) return "Nötr — ne alıcı ne satıcı baskın";
  if (rsi <= 70) return "Pozitif momentum — alıcılar güçlü";
  if (rsi <= 80) return "Aşırı alım bölgesinde — düzeltme riski";
  return "Çok aşırı alım — kar satışı gelebilir";
}

export function interpretMACD(hist: number | null): string {
  if (hist == null) return "";
  if (hist > 1) return "Güçlü yukarı momentum";
  if (hist > 0) return "Pozitif momentum — alıcılar önde";
  if (hist > -1) return "Hafif negatif — satıcılar hafif baskın";
  return "Güçlü aşağı momentum — satıcılar hakim";
}

export function interpretBB(percentB: number | null, squeeze: boolean): string {
  if (percentB == null) return "";
  if (squeeze) return "Bantlar sıkışıyor — güçlü kırılım yakın";
  if (percentB > 1) return "Üst bandın üstünde — aşırı genişleme";
  if (percentB > 0.8) return "Üst banda yakın — tepe bölgesi";
  if (percentB > 0.5) return "Ortanın üstünde — olumlu";
  if (percentB > 0.2) return "Ortanın altında — baskı altında";
  if (percentB > 0) return "Alt banda yakın — dip bölgesi";
  return "Alt bandın altında — aşırı satım";
}

export function interpretADX(adx: number | null): string {
  if (adx == null) return "";
  if (adx >= 40) return "Çok güçlü trend — yönüne güven";
  if (adx >= 25) return "Güçlü trend mevcut";
  if (adx >= 15) return "Zayıf trend — yön belirsizleşiyor";
  return "Trend yok — yatay piyasa";
}

export function interpretCMF(cmf: number | null): string {
  if (cmf == null) return "";
  if (cmf > 0.1) return "Güçlü para girişi — kurumsal birikim";
  if (cmf > 0.05) return "Hafif para girişi";
  if (cmf > -0.05) return "Nötr — belirgin akış yok";
  if (cmf > -0.1) return "Hafif para çıkışı";
  return "Güçlü para çıkışı — kurumsal satış";
}

export function interpretStoch(k: number | null): string {
  if (k == null) return "";
  if (k <= 20) return "Aşırı satım — kısa vadeli dip";
  if (k >= 80) return "Aşırı alım — kısa vadeli tepe";
  return "Normal aralıkta";
}

// ═══ ICHIMOKU ═══

export function interpretIchimoku(priceVsCloud: string | null, cloudColor: string | null): string {
  if (!priceVsCloud) return "";
  if (priceVsCloud === "ABOVE" && cloudColor === "GREEN") return "Güçlü yükseliş yapısı — fiyat bulutun üstünde, bulut destekleyici";
  if (priceVsCloud === "ABOVE") return "Fiyat bulutun üstünde — trend yukarı";
  if (priceVsCloud === "BELOW" && cloudColor === "RED") return "Düşüş yapısı — fiyat bulutun altında, kırmızı bulut direnç";
  if (priceVsCloud === "BELOW") return "Fiyat bulutun altında — trend aşağı";
  return "Kararsızlık bölgesi — fiyat bulutun içinde, yön netleşmedi";
}

// ═══ FIBONACCI ═══

export function interpretFibZone(zone: string | null): string {
  if (!zone) return "";
  if (zone === "ABOVE_ALL") return "Tüm Fibonacci seviyelerinin üstünde — momentum güçlü";
  if (zone.includes("236")) return "Sığ düzeltme bölgesi — trend güçlü";
  if (zone.includes("382")) return "Normal düzeltme — trend hâlâ sağlam";
  if (zone.includes("500")) return "Orta düzeltme — kritik karar noktası";
  if (zone.includes("618")) return "Derin düzeltme — altın oran desteği kritik";
  if (zone.includes("786")) return "Çok derin düzeltme — trend bozulma riski";
  if (zone === "BELOW_ALL") return "Tüm destekler kırıldı — trend yapısı bozulmuş";
  return "";
}

// ═══ MAKRO ═══

export function interpretUSDTRY(change: number | null): string {
  if (change == null) return "";
  if (change > 1) return "TL hızla zayıflıyor — ithalatçılar ve borçlular baskı altında";
  if (change > 0.3) return "TL zayıflıyor — dikkatli ol";
  if (change < -0.5) return "TL güçleniyor — piyasa için olumlu";
  return "TL stabil";
}

export function interpretVIX(vix: number | null): string {
  if (vix == null) return "";
  if (vix < 15) return "Piyasalar çok sakin — risk iştahı yüksek";
  if (vix < 20) return "Normal seviye";
  if (vix < 25) return "Tedirginlik artıyor";
  if (vix < 35) return "Yüksek stres — gelişen piyasalardan para çıkışı riski";
  return "Panik seviyesi — kriz ortamı";
}

// ═══ MEVSİMSELLİK ═══

export function interpretSeason(avgReturn: number | null, winRate: number | null): string {
  if (avgReturn == null) return "";
  const wr = winRate != null ? `, %${winRate} olasılıkla yükselmiş` : "";
  if (avgReturn > 3) return `Bu ay tarihsel olarak güçlü (ort. +%${avgReturn.toFixed(1)}${wr})`;
  if (avgReturn > 0) return `Bu ay tarihsel olarak hafif olumlu (ort. +%${avgReturn.toFixed(1)}${wr})`;
  if (avgReturn > -3) return `Bu ay tarihsel olarak zayıf (ort. %${avgReturn.toFixed(1)}${wr})`;
  return `Bu ay tarihsel olarak kötü (ort. %${avgReturn.toFixed(1)}${wr}) — dikkatli ol`;
}

// ═══ PEER ═══

export function interpretPeerRank(rank: number | null, total: number, metric: string): string {
  if (rank == null || total < 2) return "";
  if (rank === 1) return `Sektöründe ${metric} bazında en iyi hisse`;
  if (rank <= Math.ceil(total / 3)) return `Sektöründe ${metric} bazında üst sıralarda (${rank}/${total})`;
  if (rank >= total) return `Sektöründe ${metric} bazında en zayıf (${rank}/${total})`;
  return `Sektöründe ${metric} bazında orta sıralarda (${rank}/${total})`;
}

// ═══ STRES TESTİ ═══

export function interpretStress(loss: number): string {
  const absLoss = Math.abs(loss);
  if (absLoss < 5) return "Sınırlı etki — dirençli yapı";
  if (absLoss < 15) return "Orta etki — dikkat edilmeli";
  if (absLoss < 25) return "Sert etki — yüksek hassasiyet";
  return "Çok sert etki — kriz dönemlerinde büyük kayıp riski";
}

// ═══ DESTEK/DİRENÇ ═══

export function interpretSR(price: number, support: number | null, resistance: number | null): string {
  if (!support || !resistance || price === 0) return "";
  const toSupport = ((price - support) / price) * 100;
  const toResistance = ((resistance - price) / price) * 100;
  if (toSupport < 2) return `Desteğe çok yakın (%${toSupport.toFixed(1)}) — kırılırsa sert düşüş`;
  if (toResistance < 2) return `Dirence çok yakın (%${toResistance.toFixed(1)}) — kırılırsa güçlü yükseliş`;
  return `Desteğe %${toSupport.toFixed(1)}, dirence %${toResistance.toFixed(1)} uzaklıkta`;
}
