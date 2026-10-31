import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";

import { Avatar } from "@/components/avatar";
import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/lib/db/client";
import { member } from "@/lib/db/schema";
import { isSuperAdmin, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const superAdmin = isSuperAdmin(session.user);

  let hasOrgAdminAccess = false;
  if (!superAdmin) {
    const [managed] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          inArray(member.role, ["owner", "admin", "manager"]),
        ),
      )
      .limit(1);
    hasOrgAdminAccess = Boolean(managed);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Solid background rather than a blur: an ancestor with a backdrop-filter
        becomes the containing block for `position: fixed` children, which
        pinned the phone tab bar to the top of the header instead of the
        bottom of the screen.
      */}
      <OfflineBanner />

      <header className="border-border/70 bg-background sticky top-0 z-30 border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="inline-flex rounded-md outline-offset-4">
            <BrandLockup />
          </Link>

          <div className="flex items-center gap-2">
            <AppNav
              superAdmin={superAdmin}
              hasOrgAdminAccess={hasOrgAdminAccess}
            />
            <ThemeToggle />
            <Link
              href="/profile"
              aria-label="Your profile"
              className="hover:bg-accent rounded-full p-0.5 transition-colors"
            >
              <Avatar
                name={session.user.name}
                src={session.user.image}
                className="size-8 text-xs"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* The bottom padding keeps content clear of the phone tab bar. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 sm:px-5 sm:pb-12">
        {children}
      </main>
    </div>
  );
}
