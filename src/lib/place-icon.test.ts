import { describe, expect, it } from "vitest";
import { Dumbbell, Building2, Users, Package, Store, Stethoscope, HardHat, Coffee, MapPin } from "lucide-react";
import { getPlaceIconComponent } from "../components/place-icon";

describe("Place Icon Resolution", () => {
  it("resolves icon components from explicit icon slugs", () => {
    expect(getPlaceIconComponent("dumbbell")).toBe(Dumbbell);
    expect(getPlaceIconComponent("building-2")).toBe(Building2);
    expect(getPlaceIconComponent("users")).toBe(Users);
    expect(getPlaceIconComponent("package")).toBe(Package);
    expect(getPlaceIconComponent("store")).toBe(Store);
    expect(getPlaceIconComponent("stethoscope")).toBe(Stethoscope);
    expect(getPlaceIconComponent("hard-hat")).toBe(HardHat);
    expect(getPlaceIconComponent("coffee")).toBe(Coffee);
    expect(getPlaceIconComponent("map-pin")).toBe(MapPin);
  });

  it("infers appropriate icon component from place type name when slug is null/empty", () => {
    expect(getPlaceIconComponent(null, "Gym")).toBe(Dumbbell);
    expect(getPlaceIconComponent(null, "Fitness Center")).toBe(Dumbbell);
    expect(getPlaceIconComponent(null, "Head Office")).toBe(Building2);
    expect(getPlaceIconComponent(null, "Corporate HQ")).toBe(Building2);
    expect(getPlaceIconComponent(null, "Co-working space")).toBe(Users);
    expect(getPlaceIconComponent(null, "Community Hub")).toBe(Users);
    expect(getPlaceIconComponent(null, "Central Warehouse")).toBe(Package);
    expect(getPlaceIconComponent(null, "Retail Store")).toBe(Store);
    expect(getPlaceIconComponent(null, "Medical Clinic")).toBe(Stethoscope);
    expect(getPlaceIconComponent(null, "Construction Site")).toBe(HardHat);
    expect(getPlaceIconComponent(null, "Downtown Cafe")).toBe(Coffee);
  });

  it("falls back to MapPin when neither slug nor name match specific categories", () => {
    expect(getPlaceIconComponent(null, "Other")).toBe(MapPin);
    expect(getPlaceIconComponent(null, "")).toBe(MapPin);
    expect(getPlaceIconComponent(null, null)).toBe(MapPin);
    expect(getPlaceIconComponent("unknown-slug", "Random Unknown")).toBe(MapPin);
  });
});
