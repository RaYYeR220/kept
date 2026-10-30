import type { Metadata, Viewport } from "next";
import { Figtree, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-outfit" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "Kept — Keep looking like you",
  description:
    "Before chemotherapy changes your hair and brows, Kept measures them with YouCam AI. Every wig, brow and colour you choose after starts from you.",
  applicationName: "Kept",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f2eee8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
