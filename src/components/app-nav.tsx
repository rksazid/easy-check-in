"use client";

import {
  Building2,
  CircleDot,
  History,
  Shield,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Kept inside this client module on purpose. A Server Component that imports a
 * plain value from a "use client" file receives a client reference rather than
 * the value, and icon components cannot be passed across the boundary as props
 * either, so the server sends a boolean and the list is assembled here.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Check in", icon: CircleDot },
  { href: "/activity", label: "Activity", icon: History },
  { href: "/orgs", label: "Organizations", icon: Building2 },
  { href: "/profile", label: "You", icon: User },
];

const SUPER_ADMIN_ITEM: NavItem = {
  href: "/sa",
  label: "Super admin",
  icon: Shield,
};

const ORG_ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: ShieldCheck,
};

/**
 * One nav, laid out two ways. On a phone it is a fixed tab bar at the bottom,
 * where a thumb already rests; from the `sm` breakpoint up it becomes a row of
 * links inside the header. Rendering two separate navs instead would put the
 * same links in the page twice for anyone using a screen reader.
 */
export function AppNav({
  superAdmin,
  hasOrgAdminAccess = false,
}: {
  superAdmin: boolean;
  hasOrgAdminAccess?: boolean;
}) {
  const pathname = usePathname();
  const items = superAdmin
    ? [...NAV_ITEMS, SUPER_ADMIN_ITEM]
    : hasOrgAdminAccess
      ? [...NAV_ITEMS, ORG_ADMIN_ITEM]
      : NAV_ITEMS;

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "bg-background/95 border-border/70 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        "sm:static sm:z-auto sm:border-t-0 sm:bg-transparent sm:pb-0 sm:backdrop-blur-none",
      )}
    >
      <ul className="mx-auto flex max-w-lg sm:max-w-none sm:gap-1">
        {items.map((item) => {
          const current = isCurrent(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1 sm:flex-initial">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2",
                  "text-[11px] font-medium transition-colors",
                  "sm:min-h-0 sm:flex-row sm:rounded-md sm:px-3 sm:py-2 sm:text-sm",
                  current
                    ? "text-signal sm:text-foreground sm:bg-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 sm:hidden"
                  strokeWidth={current ? 2.4 : 1.8}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
