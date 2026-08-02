import type { Metadata, Viewport } from "next";
import { Cormorant_SC, Cormorant_Garamond, Source_Serif_4, Inter, IBM_Plex_Mono } from "next/font/google";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

const cormorantSC = Cormorant_SC({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cormorant-sc",
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ALFRET — Evidence-First Repository Butler",
  description: "ALFRET orchestrates repository maintenance, contract verification, and bounded agent handoffs through deterministic policy and evidence-driven decision-making. Persistence layer with Orders, Sessions, CUE Reports, and Maid findings.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const fontVariables = [
  cormorantSC.variable,
  cormorantGaramond.variable,
  sourceSerif.variable,
  inter.variable,
  ibmPlexMono.variable,
].join(" ");

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${fontVariables}`}>
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
