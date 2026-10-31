"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Suppress React 19 development-only false positive for next-themes inline FOUC script
if (process.env.NODE_ENV === "development") {
  const originalError = console.error;
  if (!("__react19_script_suppressed__" in console)) {
    Object.defineProperty(console, "__react19_script_suppressed__", {
      value: true,
      enumerable: false,
    });
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Encountered a script tag while rendering React component")
      ) {
        return;
      }
      originalError.apply(console, args);
    };
  }
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

