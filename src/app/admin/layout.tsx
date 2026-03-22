import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true },
  });

  if (user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <div className="hidden md:block">
        <AdminSidebar userEmail={user.email} />
      </div>

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-sidebar">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-400 uppercase">
            Admin
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
