import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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
    Credentials({
      id: "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.toLowerCase().trim();
        const code = credentials?.code as string;
        if (!email || !code) {
          console.error("[otp-auth] Missing email or code");
          return null;
        }

        const hashedToken = hashToken(code);

        const verificationToken = await prisma.verificationToken.findFirst({
          where: { identifier: email, token: hashedToken },
        });

        if (!verificationToken) {
          console.error("[otp-auth] Token not found for:", email);
          return null;
        }

        if (verificationToken.expires < new Date()) {
          console.error("[otp-auth] Token expired for:", email);
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
