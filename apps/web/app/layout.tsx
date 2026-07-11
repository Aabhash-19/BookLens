import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "BookLens — Scan Books. Discover More.",
    template: "%s | BookLens",
  },
  description:
    "BookLens is your intelligent reading companion. Photograph a book cover or barcode to instantly identify it, track your library, and get personalised recommendations.",
  keywords: ["books", "reading", "book scanner", "recommendations", "library"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BookLens",
  },
  openGraph: {
    type: "website",
    siteName: "BookLens",
    title: "BookLens — Scan Books. Discover More.",
    description: "Your intelligent reading companion powered by AI.",
  },
};

export const viewport: Viewport = {
  themeColor: "#3d62f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-[#0a0a1a] text-white antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
