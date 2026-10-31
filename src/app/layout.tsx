import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";

import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: { default: "Easy Check-In", template: "%s | Easy Check-In" },
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0C1F26" },
  ],
  // The check-in button is thumb-sized by design, so zooming stays available.
  width: "device-width",
  initialScale: 1,
  // Lets the page paint behind the notch and home indicator, which is what the
  // safe-area insets in the tab bar then account for.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
