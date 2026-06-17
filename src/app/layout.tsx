import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { CLINIC } from "@/lib/clinic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Visage — see what an injector would notice",
  description:
    "Scan your face for an educational read on the filler areas an expert injector might discuss, then book a consult. A simulation, not medical advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      style={{ "--accent": CLINIC.accent } as React.CSSProperties}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
