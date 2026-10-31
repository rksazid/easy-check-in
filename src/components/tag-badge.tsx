import { cn } from "@/lib/utils";

export const TAG_COLORS = [
  {
    id: "slate",
    label: "Slate",
    bg: "bg-slate-500/15 dark:bg-slate-500/25",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
    dot: "bg-slate-500",
    ring: "ring-slate-500",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "bg-blue-500/15 dark:bg-blue-500/25",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
    ring: "ring-blue-500",
  },
  {
    id: "emerald",
    label: "Green",
    bg: "bg-emerald-500/15 dark:bg-emerald-500/25",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  {
    id: "amber",
    label: "Amber",
    bg: "bg-amber-500/15 dark:bg-amber-500/25",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
    ring: "ring-amber-500",
  },
  {
    id: "violet",
    label: "Purple",
    bg: "bg-violet-500/15 dark:bg-violet-500/25",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-500/30",
    dot: "bg-violet-500",
    ring: "ring-violet-500",
  },
  {
    id: "rose",
    label: "Rose",
    bg: "bg-rose-500/15 dark:bg-rose-500/25",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    dot: "bg-rose-500",
    ring: "ring-rose-500",
  },
  {
    id: "cyan",
    label: "Cyan",
    bg: "bg-cyan-500/15 dark:bg-cyan-500/25",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-500/30",
    dot: "bg-cyan-500",
    ring: "ring-cyan-500",
  },
  {
    id: "orange",
    label: "Orange",
    bg: "bg-orange-500/15 dark:bg-orange-500/25",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-500/30",
    dot: "bg-orange-500",
    ring: "ring-orange-500",
  },
] as const;

export type TagColorId = (typeof TAG_COLORS)[number]["id"];

export function getTagColorStyles(color?: string | null) {
  const match = TAG_COLORS.find((c) => c.id === color);
  return match ?? TAG_COLORS[0];
}

export function TagBadge({
  name,
  color = "slate",
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const c = getTagColorStyles(color);
  return (
    <span
      data-slot="tag-badge"
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
        c.bg,
        c.text,
        c.border,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", c.dot)} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

