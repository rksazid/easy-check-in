import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

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
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
