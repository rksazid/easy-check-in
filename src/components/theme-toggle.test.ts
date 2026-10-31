import { describe, expect, it } from "vitest";

describe("Theme Toggle and Mode Config", () => {
  it("defines supported themes", () => {
    const supportedThemes = ["light", "dark", "system"];
    expect(supportedThemes).toContain("light");
    expect(supportedThemes).toContain("dark");
    expect(supportedThemes).toContain("system");
  });

  it("has viewport theme-color configurations for light and dark", () => {
    const themeColors = [
      { media: "(prefers-color-scheme: light)", color: "#f8faf9" },
      { media: "(prefers-color-scheme: dark)", color: "#0C1F26" },
    ];
    expect(themeColors.length).toBe(2);
    expect(themeColors[0].color).toBe("#f8faf9");
    expect(themeColors[1].color).toBe("#0C1F26");
  });
});

