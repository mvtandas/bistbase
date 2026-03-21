import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function getAuthenticatedUser(request?: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Rate limit per user: 60 requests per minute
  if (request) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ??
      session.user.id;
    const { success } = rateLimit(`api:${ip}`, 60, 60_000);
    if (!success) return "RATE_LIMITED" as const;
  }

  return session.user;
}

export function securityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
