import { Logo } from "@/components/shared/logo";
import { SpkDisclaimer } from "@/components/shared/spk-disclaimer";

const productLinks = [
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Nasıl Çalışır", href: "#nasil-calisir" },
];

const legalLinks = [
  { label: "Gizlilik Politikası", href: "#" },
  { label: "Kullanım Şartları", href: "#" },
  { label: "KVKK", href: "#" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border/30 bg-card/10">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              BİST için yapay zeka destekli analiz platformu. Günlük analiz, sinyal takibi
              ve portföy yönetimi.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Ürün</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Yasal</h4>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">İletişim</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:destek@bistbase.com"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  destek@bistbase.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Bistbase. Tüm hakları saklıdır.
          </p>
          <SpkDisclaimer />
        </div>
      </div>
    </footer>
  );
}
