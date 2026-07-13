import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://farm-duck-web-production.up.railway.app"
  ),
  title: "เจ้านายฟาร์มเป็ด — ระบบ POS ล้งไข่",
  description: "ระบบ POS & สต๊อก ล้งไข่ เจ้านายฟาร์มเป็ด (FARM DUCK)",
  openGraph: {
    title: "เจ้านายฟาร์มเป็ด (FARM DUCK)",
    description: "ระบบ POS & สต๊อก ล้งไข่",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "เจ้านายฟาร์มเป็ด (FARM DUCK)",
    description: "ระบบ POS & สต๊อก ล้งไข่",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
