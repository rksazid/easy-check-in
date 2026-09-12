import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Easy Check-In",
    short_name: "Check-In",
    description: "Check in where you are, in one tap.",
    start_url: "/",
    // Standalone so the installed app opens without browser chrome, which is
    // what lets the single large button read as the whole screen.
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C1F26",
    theme_color: "#0C1F26",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        // Android crops icons to its own shape; the mark sits well inside the
        // safe area, so the same file serves both purposes.
        purpose: "maskable",
      },
    ],
  };
}
