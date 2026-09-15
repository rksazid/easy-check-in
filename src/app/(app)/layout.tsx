import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { AppNav } from "@/components/app-nav";
import { BrandLockup } from "@/components/brand";
import { isSuperAdmin, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col">
      {/*
        Solid background rather than a blur: an ancestor with a backdrop-filter
        becomes the containing block for `position: fixed` children, which
        pinned the phone tab bar to the top of the header instead of the
        bottom of the screen.
      */}
      <header className="border-border/70 bg-background sticky top-0 z-30 border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="inline-flex rounded-md outline-offset-4">
            <BrandLockup />
          </Link>

          <div className="flex items-center gap-2">
            <AppNav superAdmin={isSuperAdmin(session.user)} />
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
