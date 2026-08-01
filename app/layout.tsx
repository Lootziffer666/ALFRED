import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALFRET — Evidence-First Repository Butler",
  description: "ALFRET orchestrates repository maintenance, contract verification, and bounded agent handoffs through deterministic policy and evidence-driven decision-making. Persistence layer with Orders, Sessions, CUE Reports, and Maid findings.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
