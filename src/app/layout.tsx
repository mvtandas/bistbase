import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Bistbase — Borsanın gürültüsünü kapat, sinyali yakala",
    template: "%s | Bistbase",
  },
  description:
    "BİST hisseleri için yapay zeka destekli günlük analiz ve portföy takip platformu.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://bistbase.com"
  ),
  keywords: [
    "borsa istanbul",
    "bist analiz",
    "hisse analiz",
    "yapay zeka borsa",
    "portföy takip",
    "teknik analiz",
    "bistbase",
  ],
  authors: [{ name: "Bistbase" }],
  creator: "Bistbase",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Bistbase",
    title: "Bistbase — Borsanın gürültüsünü kapat, sinyali yakala",
    description:
      "BİST hisseleri için yapay zeka destekli günlük analiz ve portföy takip platformu.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bistbase — Borsanın gürültüsünü kapat, sinyali yakala",
    description:
      "BİST hisseleri için yapay zeka destekli günlük analiz ve portföy takip platformu.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
