import { describe, expect, it } from "vitest";
import { getOrgIconComponent, ORG_ICON_PRESETS } from "@/components/org-icon";
import { Building2, Dumbbell } from "lucide-react";

describe("Organization Icons", () => {
  it("provides available icon presets", () => {
    expect(ORG_ICON_PRESETS.length).toBeGreaterThan(10);
    const dumbbell = ORG_ICON_PRESETS.find((p) => p.value === "dumbbell");
    expect(dumbbell).toBeDefined();
    expect(dumbbell?.label).toContain("Gym");
  });

  it("returns matching icon component for preset", () => {
    const icon = getOrgIconComponent("dumbbell");
    expect(icon).toBe(Dumbbell);
  });

  it("falls back to Building2 for unknown or empty icon value", () => {
    expect(getOrgIconComponent(null)).toBe(Building2);
    expect(getOrgIconComponent(undefined)).toBe(Building2);
    expect(getOrgIconComponent("unknown-slug")).toBe(Building2);
  });
});

