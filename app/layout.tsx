import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LogoWatermark } from "@/components/LogoWatermark";
import { SiteHeader } from "@/components/SiteHeader";
import { TableNavProvider } from "@/components/TableNav";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, jsonLd } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    // Pages name themselves ("Salaries") and the template brands them.
    template: `%s - ${SITE_NAME}`,
    default: `${SITE_NAME}: NBA Player Value vs. Salary`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "NBA",
    "Net Value",
    "NBA salaries",
    "NBA contracts",
    "player value",
    "NBA advanced stats",
    "overpaid",
    "underpaid",
    "salary cap",
  ],
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [{ url: "/tnv.png", width: 1254, height: 1254, alt: SITE_NAME }],
  },
  twitter: { card: "summary", images: ["/tnv.png"] },
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
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            inLanguage: "en-US",
          })}
        />
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
