import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <Logo />
      <h2 className="text-xl font-semibold text-foreground mt-8 mb-2">
        Sayfa Bulunamadı
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted px-4 py-2 text-sm font-medium transition-colors"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
