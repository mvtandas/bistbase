import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      <Button variant="outline" render={<Link href="/" />}>
        Ana Sayfaya Dön
      </Button>
    </div>
  );
}
