import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/* Inter — UI body font per the BroBroker design brief.
   Keep the latin subset and expose as --font-inter so globals.css can
   compose it into --font-ui. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* Fraunces — display/brand font for the logo, hero titles, and other
   editorial moments. Loaded once here so every route can reference it. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/* Geist Mono kept for the monospaced eyebrow labels (bb-mono-label). */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BroBroker",
  description: "Deal intelligence for high-ticket brokers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col bg-white font-sans text-[#171719]">
        {children}
      </body>
    </html>
  );
}
