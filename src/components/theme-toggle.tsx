"use client";

import { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Quick toggle button for headers and navigation bars.
 * Switches smoothly between light and dark mode, with system fallback.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("size-8 p-0 text-muted-foreground", className)}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="size-4 opacity-50" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "relative size-8 p-0 text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-teal-400" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

/**
 * Segmented 3-way theme selector (Light / Dark / System)
 * Ideal for Profile and Account Settings pages.
 */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = mounted && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              isSelected
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50",
            )}
          >
            <Icon className="size-3.5" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

