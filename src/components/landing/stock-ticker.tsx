const stocks = [
  { code: "THYAO", price: "312.50", change: "+2.34", positive: true },
  { code: "ASELS", price: "58.90", change: "+1.12", positive: true },
  { code: "TUPRS", price: "178.20", change: "-0.87", positive: false },
  { code: "KCHOL", price: "196.40", change: "+0.65", positive: true },
  { code: "SAHOL", price: "89.70", change: "-1.23", positive: false },
  { code: "EREGL", price: "52.30", change: "+0.44", positive: true },
  { code: "GARAN", price: "135.80", change: "+1.78", positive: true },
  { code: "BIMAS", price: "445.60", change: "-0.32", positive: false },
  { code: "SISE", price: "67.10", change: "+0.91", positive: true },
  { code: "AKBNK", price: "62.40", change: "+1.45", positive: true },
  { code: "PGSUS", price: "1250.00", change: "+3.12", positive: true },
  { code: "TCELL", price: "98.50", change: "-0.56", positive: false },
];

function TickerItem({ code, price, change, positive }: (typeof stocks)[number]) {
  return (
    <div className="flex items-center gap-3 px-6">
      <span className="text-sm font-semibold text-foreground/80">{code}</span>
      <span className="text-sm font-mono text-muted-foreground">₺{price}</span>
      <span className={`text-xs font-mono font-medium ${positive ? "text-gain" : "text-loss"}`}>
        {positive ? "+" : ""}{change}%
      </span>
    </div>
  );
}

export function StockTicker() {
  return (
    <div className="border-y border-border/20 bg-card/10 py-4 overflow-hidden">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker 40s linear infinite" }}
      >
        {/* Double the content for seamless loop */}
        {[...stocks, ...stocks].map((stock, i) => (
          <TickerItem key={`${stock.code}-${i}`} {...stock} />
        ))}
      </div>
    </div>
  );
}
