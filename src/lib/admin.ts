import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }

  return { error: null, session };
}

export async function logCronExecution(cronName: string, fn: () => Promise<unknown>) {
  const log = await prisma.cronLog.create({
    data: { cronName, status: "RUNNING" },
  });

  const start = Date.now();
  try {
    const result = await fn();
    await prisma.cronLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        duration: Date.now() - start,
        result: result as object,
        endedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    await prisma.cronLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        duration: Date.now() - start,
        error: String(error),
        endedAt: new Date(),
      },
    });
    throw error;
  }
}
