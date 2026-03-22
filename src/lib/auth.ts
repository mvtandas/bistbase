import NextAuth from "next-auth";
import Email from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.EMAIL_SERVER_PASSWORD);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: { user: "resend", pass: process.env.EMAIL_SERVER_PASSWORD ?? "" },
      },
      from: process.env.EMAIL_FROM,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          await resend.emails.send({
            from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
            to: email,
            subject: "Bistbase - Giriş Bağlantınız",
            html: `
              <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f8fafc;">Bistbase'e Hoş Geldiniz</h2>
                <p style="color: #94a3b8;">Giriş yapmak için aşağıdaki butona tıklayın:</p>
                <a href="${url}" style="display: inline-block; background: #818cf8; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
                  Giriş Yap
                </a>
                <p style="color: #64748b; font-size: 12px;">Bu bağlantı 24 saat geçerlidir. Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
              </div>
            `,
          });
        } catch (error) {
          console.error("Email send error:", error);
          throw new Error("E-posta gönderilemedi");
        }
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
