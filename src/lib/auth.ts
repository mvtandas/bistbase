import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const resend = new Resend(process.env.EMAIL_SERVER_PASSWORD);

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/** Hash token the same way auth.js does internally */
function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(`${token}${process.env.AUTH_SECRET}`)
    .digest("hex");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: { user: "resend", pass: process.env.EMAIL_SERVER_PASSWORD ?? "" },
      },
      from: process.env.EMAIL_FROM,
      maxAge: 10 * 60, // 10 dakika geçerli
      generateVerificationToken: () => generateOTP(),
      sendVerificationRequest: async ({ identifier: email, token }) => {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "noreply@bistbase.com",
            to: email,
            subject: `Bistbase - Doğrulama Kodunuz: ${token}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 20px; background: #0f172a; border-radius: 12px;">
                <h2 style="color: #f1f5f9; margin: 0 0 8px 0; font-size: 20px;">Bistbase</h2>
                <p style="color: #94a3b8; margin: 0 0 24px 0; font-size: 14px;">Giriş yapmak için aşağıdaki kodu kullanın:</p>
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
                  <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #818cf8; font-family: monospace;">${token}</span>
                </div>
                <p style="color: #64748b; font-size: 12px; margin: 0;">Bu kod 10 dakika geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
              </div>
            `,
          });
        } catch (error) {
          console.error("Email send error:", error);
          throw new Error("E-posta gönderilemedi");
        }
      },
    }),
    Credentials({
      id: "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const code = credentials?.code as string;
        if (!email || !code) return null;

        // Hash the OTP the same way auth.js hashes email tokens
        const hashedToken = hashToken(code);

        // Look up the verification token
        const verificationToken = await prisma.verificationToken.findFirst({
          where: { identifier: email, token: hashedToken },
        });

        if (!verificationToken) return null;

        // Check expiry
        if (verificationToken.expires < new Date()) {
          // Clean up expired token
          await prisma.verificationToken.delete({
            where: {
              identifier_token: {
                identifier: email,
                token: hashedToken,
              },
            },
          });
          return null;
        }

        // Delete the used token
        await prisma.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: email,
              token: hashedToken,
            },
          },
        });

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email },
          });
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user || token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
          select: { id: true, plan: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.plan = dbUser.plan;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).plan = token.plan;
        (session.user as unknown as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
});
