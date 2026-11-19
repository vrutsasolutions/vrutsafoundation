
import type { Metadata, Viewport } from "next";
import { SITE_URL, R2_PUBLIC_URL } from "@/lib/supabase/env";
import "./globals.css";

const logoUrl = R2_PUBLIC_URL
  ? `${R2_PUBLIC_URL}/site-assets/logo.png`
  : "/logo.png";

const iconUrl = R2_PUBLIC_URL
  ? `${R2_PUBLIC_URL}/site-assets/icon.png`
  : "/icon.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Vrutsa Foundation", template: "%s | Vrutsa Foundation" },
  description: "Vrutsa Foundation: our work, our events, our district network, and how to volunteer or donate.",
  openGraph: {
    type: "website",
    siteName: "Vrutsa Foundation",
    images: [logoUrl],
  },
  icons: {
    icon: iconUrl,
    apple: iconUrl,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
