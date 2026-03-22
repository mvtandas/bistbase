import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List user's portfolio
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(portfolios);
}

// POST: Add stock to portfolio
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stockCode, quantity, avgCost } = await request.json();
  if (!stockCode || typeof stockCode !== "string") {
    return NextResponse.json(
      { error: "stockCode gerekli" },
      { status: 400 }
    );
  }

  const code = stockCode.replace(".IS", "").toUpperCase();

  // Check FREE plan limit (max 2 stocks)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (user?.plan === "FREE") {
    const count = await prisma.portfolio.count({
      where: { userId: session.user.id },
    });
    if (count >= 2) {
      return NextResponse.json(
        { error: "PREMIUM_REQUIRED", message: "Ücretsiz planda maksimum 2 hisse takip edebilirsiniz." },
        { status: 403 }
      );
    }
  }

  // Add to portfolio (upsert to prevent duplicates)
  const portfolio = await prisma.portfolio.upsert({
    where: {
      userId_stockCode: {
        userId: session.user.id,
        stockCode: code,
      },
    },
    create: {
      userId: session.user.id,
      stockCode: code,
      quantity: typeof quantity === "number" && quantity > 0 ? quantity : null,
      avgCost: typeof avgCost === "number" && avgCost > 0 ? avgCost : null,
    },
    update: {
      ...(typeof quantity === "number" && quantity > 0 ? { quantity } : {}),
      ...(typeof avgCost === "number" && avgCost > 0 ? { avgCost } : {}),
    },
  });

  return NextResponse.json(portfolio, { status: 201 });
}

// DELETE: Remove stock from portfolio
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stockCode } = await request.json();
  if (!stockCode) {
    return NextResponse.json(
      { error: "stockCode gerekli" },
      { status: 400 }
    );
  }

  const code = stockCode.replace(".IS", "").toUpperCase();

  await prisma.portfolio.deleteMany({
    where: {
      userId: session.user.id,
      stockCode: code,
    },
  });

  return NextResponse.json({ success: true });
}

// PATCH: Update quantity/cost for a stock
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stockCode, quantity, avgCost } = await request.json();
  if (!stockCode || typeof stockCode !== "string") {
    return NextResponse.json({ error: "stockCode gerekli" }, { status: 400 });
  }

  const code = stockCode.replace(".IS", "").toUpperCase();

  const updated = await prisma.portfolio.update({
    where: {
      userId_stockCode: {
        userId: session.user.id,
        stockCode: code,
      },
    },
    data: {
      quantity: typeof quantity === "number" && quantity >= 0 ? (quantity === 0 ? null : quantity) : undefined,
      avgCost: typeof avgCost === "number" && avgCost >= 0 ? (avgCost === 0 ? null : avgCost) : undefined,
    },
  });

  return NextResponse.json(updated);
}
