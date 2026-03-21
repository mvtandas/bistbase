import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { email: true, plan: true, createdAt: true },
  });

  const portfolioCount = await prisma.portfolio.count({
    where: { userId: session!.user.id },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Profil</h1>
      </div>

      <div className="space-y-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base">Hesap Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">E-posta</span>
              <span className="text-sm text-foreground">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge
                className={
                  user?.plan === "PREMIUM"
                    ? "bg-ai-premium/10 text-ai-premium border-ai-premium/20"
                    : "bg-secondary text-muted-foreground"
                }
              >
                {user?.plan === "PREMIUM" ? "Premium" : "Ücretsiz"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Takip Edilen Hisse
              </span>
              <span className="text-sm text-foreground">{portfolioCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Kayıt Tarihi</span>
              <span className="text-sm text-foreground">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("tr-TR")
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
