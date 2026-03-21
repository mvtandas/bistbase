export function HeroSection() {
  return (
    <div className="flex flex-col items-center text-center max-w-3xl mx-auto px-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-ai-primary/20 bg-ai-primary/5 px-4 py-1.5 text-sm text-ai-primary mb-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ai-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-ai-primary" />
        </span>
        Yapay Zeka Destekli Analiz
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
        Borsanın gürültüsünü kapat,{" "}
        <span className="text-ai-primary">sinyali yakala.</span>
      </h1>

      <p className="mt-6 text-lg text-muted-foreground max-w-xl">
        BİST hisselerini yapay zeka ile günlük analiz et. Her sabah portföyünün
        özetini al, trendin yönünü gör.
      </p>
    </div>
  );
}
