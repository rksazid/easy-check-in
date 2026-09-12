import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Easy Check-In",
  description: "Check in where you are, in one tap.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Check-In",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C1F26",
  // The check-in button is thumb-sized by design; zooming should stay available.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("font-sans", archivo.variable, plexMono.variable)}
    >
      {/*
        Browser extensions commonly add attributes to <body> before React
        hydrates (password managers, colour pickers, dark-mode tools), which
        React otherwise reports as a hydration mismatch the user cannot fix.
        This suppresses the attribute comparison on this element only; children
        are still checked normally.
      */}
      <body className="min-h-dvh antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
