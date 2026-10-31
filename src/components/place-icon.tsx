import {
  Briefcase,
  Building2,
  Coffee,
  Dumbbell,
  HardHat,
  Home,
  MapPin,
  Package,
  Stethoscope,
  Store,
  Trees,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const PLACE_ICON_MAP: Record<string, LucideIcon> = {
  "building-2": Building2,
  "dumbbell": Dumbbell,
  "users": Users,
  "package": Package,
  "store": Store,
  "stethoscope": Stethoscope,
  "hard-hat": HardHat,
  "coffee": Coffee,
  "home": Home,
  "trees": Trees,
  "briefcase": Briefcase,
  "map-pin": MapPin,
};

/**
 * Resolves the appropriate Lucide icon component given an icon slug or place type name.
 */
export function getPlaceIconComponent(
  iconSlug?: string | null,
  typeName?: string | null,
): LucideIcon {
  if (iconSlug && PLACE_ICON_MAP[iconSlug]) {
    return PLACE_ICON_MAP[iconSlug];
  }

  if (typeName) {
    const lower = typeName.toLowerCase();
    if (lower.includes("gym") || lower.includes("fitness")) return Dumbbell;
    if (lower.includes("office") || lower.includes("corporate")) return Building2;
    if (lower.includes("co-work") || lower.includes("community")) return Users;
    if (lower.includes("warehouse") || lower.includes("storage")) return Package;
    if (lower.includes("store") || lower.includes("shop") || lower.includes("retail")) return Store;
    if (lower.includes("clinic") || lower.includes("hospital") || lower.includes("health")) return Stethoscope;
    if (lower.includes("site") || lower.includes("construction")) return HardHat;
    if (lower.includes("cafe") || lower.includes("coffee") || lower.includes("restaurant")) return Coffee;
    if (lower.includes("home")) return Home;
    if (lower.includes("park") || lower.includes("nature")) return Trees;
  }

  return MapPin;
}

export type PlaceIconProps = {
  imageUrl?: string | null;
  icon?: string | null;
  typeName?: string | null;
  name?: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

export function PlaceIcon({
  imageUrl,
  icon,
  typeName,
  name,
  className,
  size = "md",
}: PlaceIconProps) {
  const sizeClasses = {
    xs: "size-7 rounded-md",
    sm: "size-9 rounded-lg",
    md: "size-12 rounded-xl",
    lg: "size-14 rounded-xl",
    xl: "size-16 rounded-2xl",
  };

  const iconSizes = {
    xs: "size-3.5",
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
    xl: "size-7",
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name ?? typeName ?? "Place"}
        className={cn(
          "border-border/70 shrink-0 border object-cover shadow-2xs",
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  const Icon = getPlaceIconComponent(icon, typeName);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-border/70 bg-muted/60 text-muted-foreground/80 shadow-2xs transition-colors",
        sizeClasses[size],
        className,
      )}
      aria-label={typeName ?? "Place icon"}
    >
      <Icon className={cn(iconSizes[size], "transition-transform duration-150")} />
    </div>
  );
}

