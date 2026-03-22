import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertPreferencesForm } from "./alert-prefs";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, plan: true, createdAt: true },
  });

  const portfolioCount = await prisma.portfolio.count({
    where: { userId: session.user.id },
  });

  // Get or create alert preferences
  let alertPrefs = await prisma.alertPreference.findUnique({
    where: { userId: session.user.id },
  });

  if (!alertPrefs) {
    alertPrefs = await prisma.alertPreference.create({
      data: { userId: session.user.id },
    });
  }

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
              <Badge className="bg-ai-primary/10 text-ai-primary border-ai-primary/20">
                Beta
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Takip Edilen</span>
              <span className="text-sm text-foreground">{portfolioCount} hisse</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Kayıt</span>
              <span className="text-sm text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <AlertPreferencesForm
          userId={session.user.id}
          initial={{
            morningDigest: alertPrefs.morningDigest,
            signalAlerts: alertPrefs.signalAlerts,
            scoreChangeAlerts: alertPrefs.scoreChangeAlerts,
            macroAlerts: alertPrefs.macroAlerts,
            weeklyReport: alertPrefs.weeklyReport,
          }}
        />
      </div>
    </div>
  );
}
