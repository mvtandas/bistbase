import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(`${token}${process.env.AUTH_SECRET}`)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = body?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "Email gerekli" }, { status: 400 });
    }

    const email = rawEmail.toLowerCase().trim();

    // Rate limit: 3 OTP emails per email per 10 minutes
    const rl = await rateLimitAsync(`send-otp:${email}`, 3, 10 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme. Lütfen birkaç dakika bekleyin." },
        { status: 429 }
      );
    }

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const ipRl = await rateLimitAsync(`send-otp-ip:${ip}`, 5, 10 * 60 * 1000);
    if (!ipRl.success) {
      return NextResponse.json(
        { error: "Çok fazla deneme. Lütfen birkaç dakika bekleyin." },
        { status: 429 }
      );
    }

    const otp = generateOTP();
    const hashedToken = hashToken(otp);
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Store the new hashed token
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires,
      },
    });

    // Send email with raw OTP
    const sent = await sendEmail({
      to: email,
      subject: `Bistbase - Doğrulama Kodunuz: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 20px; background: #0f172a; border-radius: 12px;">
          <h2 style="color: #f1f5f9; margin: 0 0 8px 0; font-size: 20px;">Bistbase</h2>
          <p style="color: #94a3b8; margin: 0 0 24px 0; font-size: 14px;">Giriş yapmak için aşağıdaki kodu kullanın:</p>
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #818cf8; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; margin: 0;">Bu kod 10 dakika geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `,
    });

    if (!sent) {
      console.error("[send-otp] Email send failed for:", email);
      return NextResponse.json(
        { error: "E-posta gönderilemedi. Tekrar deneyin." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-otp] Unexpected error:", error);
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
