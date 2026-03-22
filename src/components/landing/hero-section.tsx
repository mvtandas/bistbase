import { GridBackground } from "./grid-background";
import { EmailCta } from "./email-cta";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16">
      <GridBackground />

      <div className="max-w-7xl mx-auto px-6 w-full py-20 lg:py-0">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
          {/* Left column - Text */}
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-ai-primary/20 bg-ai-primary/5 px-4 py-1.5 text-sm text-ai-primary mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-ai-primary" />
              </span>
              Yapay Zeka Destekli Analiz
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] animate-slide-up">
              Borsanın gürültüsünü kapat,{" "}
              <span
                className="bg-gradient-to-r from-ai-primary via-violet-400 to-ai-primary bg-[length:200%_auto] bg-clip-text text-transparent"
                style={{ animation: "gradientShift 4s ease-in-out infinite" }}
              >
                sinyali yakala.
              </span>
            </h1>

            <p className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-lg animate-slide-up stagger-2">
              BİST hisselerini yapay zeka ile günlük analiz et. Her sabah portföyünün
              özetini al, trendin yönünü gör.
            </p>

            <div className="mt-8 w-full max-w-md animate-slide-up stagger-3">
              <EmailCta />
            </div>

            <p className="mt-3 text-xs text-muted-foreground/60 animate-slide-up stagger-4">
              Ücretsiz başla — Kredi kartı gerekmez
            </p>
          </div>

          {/* Right column - Floating cards */}
          <div className="flex-1 relative w-full max-w-lg lg:max-w-xl animate-fade-in stagger-3">
            <div
              className="relative w-full aspect-square transition-transform duration-700 hover:[transform:perspective(1000px)_rotateY(0deg)_rotateX(0deg)]"
              style={{ transform: "perspective(1000px) rotateY(-5deg) rotateX(3deg)" }}
            >
              {/* Back card - Portfolio dashboard */}
              <div
                className="absolute inset-0 rounded-2xl border border-border/20 bg-card/40 backdrop-blur-sm p-6"
                style={{ animation: "float 6s ease-in-out infinite" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-loss/50" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
                  <div className="h-3 w-3 rounded-full bg-gain/50" />
                </div>
                <div className="space-y-3">
                  <div className="h-2 bg-foreground/5 rounded-full w-3/4" />
                  <div className="h-2 bg-foreground/5 rounded-full w-1/2" />
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="h-16 bg-foreground/[0.03] rounded-lg" />
                    <div className="h-16 bg-foreground/[0.03] rounded-lg" />
                    <div className="h-16 bg-foreground/[0.03] rounded-lg" />
                  </div>
                  <div className="h-24 bg-foreground/[0.03] rounded-lg mt-4" />
                </div>
              </div>

              {/* Middle card - AI Analysis */}
              <div
                className="absolute top-[15%] right-[-5%] w-[75%] rounded-2xl border border-ai-primary/20 bg-card/60 backdrop-blur-md p-5 shadow-2xl"
                style={{ animation: "float 5s ease-in-out infinite 0.5s" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">THYAO</span>
                    <span className="text-xs text-muted-foreground">Türk Hava Yolları</span>
                  </div>
                  <span className="text-xs font-medium text-gain bg-gain/10 px-2 py-0.5 rounded-md">
                    +2.34%
                  </span>
                </div>
                {/* Mini sparkline SVG */}
                <svg viewBox="0 0 200 40" className="w-full h-10 mb-3">
                  <polyline
                    points="0,35 20,30 40,32 60,25 80,28 100,20 120,22 140,15 160,18 180,10 200,8"
                    fill="none"
                    stroke="oklch(0.765 0.177 163.223)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="oklch(0.765 0.177 163.223)" stopOpacity="0" />
                  </linearGradient>
                  <polygon
                    points="0,35 20,30 40,32 60,25 80,28 100,20 120,22 140,15 160,18 180,10 200,8 200,40 0,40"
                    fill="url(#sparkGrad)"
                  />
                </svg>
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-foreground/10 rounded-full w-full" />
                  <div className="h-1.5 bg-foreground/10 rounded-full w-4/5" />
                  <div className="h-1.5 bg-foreground/10 rounded-full w-3/5" />
                </div>
              </div>

              {/* Front card - Signal badge */}
              <div
                className="absolute bottom-[20%] left-[5%] rounded-xl border border-gain/20 bg-card/70 backdrop-blur-md px-4 py-3 shadow-2xl"
                style={{ animation: "float 4s ease-in-out infinite 1s" }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gain/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-gain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
                      <polyline points="16,7 22,7 22,13" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Sinyal</span>
                    <span className="text-sm font-semibold text-gain">AL — THYAO</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
