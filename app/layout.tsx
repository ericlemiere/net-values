import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LogoWatermark } from "@/components/LogoWatermark";
import { SiteHeader } from "@/components/SiteHeader";
import { TableNavProvider } from "@/components/TableNav";
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
  title: "The Net Values",
  description:
    "A way to evaluate an NBA player's Net Value based on their production on the court and salary.",
  icons: {
    icon: [{ url: "/tnv2.png" }],
    apple: [{ url: "/tnv2.png" }],
    shortcut: [{ url: "/tnv2.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LogoWatermark />
        <SiteHeader />
        {/* Offset by the header's height, which no longer takes up flow space. */}
        <main className="site-main relative z-10 flex min-w-0 flex-1 flex-col">
          <TableNavProvider>{children}</TableNavProvider>
        </main>
      </body>
    </html>
  );
}
