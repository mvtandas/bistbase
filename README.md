# 📈 BistBase — AI-Powered Stock Analysis Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude_AI-D97757?style=for-the-badge&logo=anthropic&logoColor=white)

**BIST hisse senetleri için yapay zeka destekli analiz, teknik göstergeler ve backtesting platformu.**

</div>

---

## ✨ Özellikler

- 🤖 **AI Destekli Analiz** — Anthropic Claude SDK ile akıllı hisse değerlendirme ve öneriler
- 📊 **Gerçek Zamanlı Grafikler** — Lightweight Charts ile interaktif fiyat grafikleri
- 📈 **Teknik Analiz** — RSI, MACD, Bollinger Bands ve daha fazlası
- 🔐 **Kullanıcı Yönetimi** — NextAuth ile güvenli kimlik doğrulama
- ⚡ **Redis Cache** — Upstash Redis ile yüksek performanslı veri önbellekleme
- 📰 **Finans Haberleri** — RSS entegrasyonu ile güncel piyasa haberleri
- 📧 **E-posta Bildirimleri** — Resend ile portföy uyarıları
- 🌙 **Dark Mode** — Göz dostu karanlık tema desteği
- 📤 **Veri Dışa Aktarma** — Analiz sonuçlarını dışa aktarma

## 🛠 Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| **Backend** | Next.js API Routes, Node.js |
| **Veritabanı** | PostgreSQL + Prisma ORM 7.5 |
| **AI** | Anthropic Claude SDK |
| **Cache** | Upstash Redis |
| **Auth** | NextAuth 5 (Beta) |
| **Veri** | Yahoo Finance API |
| **Monitoring** | Sentry |
| **UI** | shadcn/ui, Framer Motion, Lucide Icons |

## 📁 Proje Yapısı

```
src/
├── app/
│   ├── (auth)/           # Kimlik doğrulama sayfaları
│   ├── admin/            # Admin dashboard
│   ├── dashboard/        # Ana dashboard
│   ├── api/              # 25+ API endpoint
│   └── onboarding/       # Kullanıcı onboarding
├── components/           # React bileşenleri
├── lib/                  # AI, cron, stock data modülleri
├── hooks/                # Custom React hooks
└── types/                # TypeScript tanımları
```

## 🚀 Kurulum

```bash
git clone https://github.com/mvtandas/bistbase.git
cd bistbase
npm install
cp .env.example .env.local  # Ortam değişkenlerini düzenle
npx prisma migrate dev
npm run dev
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 Lisans

MIT
