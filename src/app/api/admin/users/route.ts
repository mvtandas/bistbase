import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const plan = searchParams.get("plan") || "";
  const role = searchParams.get("role") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};
  if (search) {
    where.email = { contains: search, mode: "insensitive" };
  }
  if (plan === "FREE" || plan === "PREMIUM") {
    where.plan = plan;
  }
  if (role === "USER" || role === "ADMIN") {
    where.role = role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        plan: true,
        role: true,
        createdAt: true,
        _count: { select: { portfolios: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
