import { NextResponse } from "next/server";
import { getMacroData } from "@/lib/stock/macro";

export async function GET() {
  try {
    const data = await getMacroData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
