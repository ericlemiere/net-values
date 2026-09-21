import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { NavLinks } from "@/components/NavLinks";
import { PlayerSearch } from "@/components/PlayerSearch";
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
  description: "NBA player stats, advanced stats, and salaries",
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
        <div className="logo-watermark" aria-hidden="true" />
        {/*
          The header must out-rank <main>, not just tie it: both are positioned,
          so each opens its own stacking context, and the search dropdown's
          z-50 only ever competes INSIDE the header's. On a tie, <main> wins on
          DOM order and its content (the stats page toggle) covers the results.
        */}
        {/*
          Fixed, so it stays put while a long table scrolls under it. That makes
          the opaque background load-bearing rather than decorative: without it
          the rows would show through.
        */}
        <header className="site-header fixed inset-x-0 top-0 z-30 bg-background">
          <div className="site-header-backdrop" aria-hidden="true">
            <div className="logo-watermark" />
          </div>
          {/* Above the header's copy of the watermark, so the nav stays legible. */}
          <div className="relative z-1 mx-auto flex h-full max-w-350 items-center gap-6 px-6">
            <Link
              href="/"
              className="font-semibold text-white border-2 border-accent rounded px-2 py-1"
            >
              The Net Values
            </Link>
            <NavLinks />
            <PlayerSearch />
          </div>
        </header>
        {/* Offset by the header's height, which no longer takes up flow space. */}
        <main className="site-main relative z-10 flex flex-1 flex-col">
          <TableNavProvider>{children}</TableNavProvider>
        </main>
      </body>
    </html>
  );
}
