import {
  Briefcase,
  Building2,
  Coffee,
  Dumbbell,
  Flame,
  Globe,
  HeartPulse,
  MapPin,
  Shield,
  Sparkles,
  Store,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const ORG_ICON_PRESETS = [
  { value: "dumbbell", label: "Gym / Fitness", icon: Dumbbell },
  { value: "building-2", label: "Office / Company", icon: Building2 },
  { value: "users", label: "Community / Club", icon: Users },
  { value: "trophy", label: "Sports / League", icon: Trophy },
  { value: "flame", label: "Crossfit / Power", icon: Flame },
  { value: "heart-pulse", label: "Health / Wellness", icon: HeartPulse },
  { value: "zap", label: "Performance", icon: Zap },
  { value: "briefcase", label: "Enterprise / Firm", icon: Briefcase },
  { value: "coffee", label: "Cafe / Workspace", icon: Coffee },
  { value: "store", label: "Retail / Store", icon: Store },
  { value: "shield", label: "Security / Defense", icon: Shield },
  { value: "globe", label: "Global / Remote", icon: Globe },
  { value: "sparkles", label: "Creative / Studio", icon: Sparkles },
  { value: "map-pin", label: "General Venue", icon: MapPin },
] as const;

export function getOrgIconComponent(logo?: string | null) {
  const match = ORG_ICON_PRESETS.find((p) => p.value === logo);
  return match ? match.icon : Building2;
}

export function OrgIcon({
  logo,
  name,
  className,
  size = "md",
}: {
  logo?: string | null;
  name?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  // If logo is a custom image URL, render as image
  if (
    logo &&
    (logo.startsWith("http://") ||
      logo.startsWith("https://") ||
      logo.startsWith("/"))
  ) {
    return (
      <img
        src={logo}
        alt={name ? `${name} logo` : "Organization logo"}
        className={cn(
          "border-border/60 shrink-0 rounded-lg border object-cover",
          size === "sm" && "size-6",
          size === "md" && "size-8",
          size === "lg" && "size-10",
          className,
        )}
      />
    );
  }

  const IconComponent = getOrgIconComponent(logo);

  return (
    <span
      className={cn(
        "bg-secondary text-secondary-foreground border-border/50 flex shrink-0 items-center justify-center rounded-lg border",
        size === "sm" && "size-6",
        size === "md" && "size-8",
        size === "lg" && "size-10",
        className,
      )}
      aria-hidden="true"
    >
      <IconComponent
        className={cn(
          size === "sm" && "size-3.5",
          size === "md" && "size-4",
          size === "lg" && "size-5",
        )}
      />
    </span>
  );
}

