import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSectorRotation } from "@/lib/stock/sector-rotation";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rotation = await getSectorRotation();
    return NextResponse.json(rotation);
  } catch {
    return NextResponse.json([]);
  }
}
