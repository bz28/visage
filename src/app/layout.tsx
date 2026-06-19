import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import "./globals.css";
import { CLINIC } from "@/lib/clinic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Editorial serif for display headings — warm, premium, human (med-spa, not tech).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: `${CLINIC.name} — see your features, then book a consultation`,
  description:
    "Take a quick look at the areas we might explore together — and why — then book your consultation. A guide to start the conversation, not medical advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
      style={{ "--accent": CLINIC.accent } as React.CSSProperties}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
