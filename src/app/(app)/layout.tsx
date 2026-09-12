import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { BrandLockup } from "@/components/brand";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";
import { isSuperAdmin, requireSession } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const superAdmin = isSuperAdmin(session.user);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border/70 border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="inline-flex rounded-md outline-offset-4">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              className="hover:bg-accent flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors"
            >
              <Avatar
                name={session.user.name}
                src={session.user.image}
                className="size-8 text-xs"
              />
              <span className="hidden text-sm font-medium sm:inline">
                {session.user.name}
              </span>
            </Link>
            <SignOutButton />
          </div>
        </div>

        <nav className="mx-auto flex w-full max-w-3xl gap-1 px-4 pb-1">
          <NavLink href="/">Check in</NavLink>
          <NavLink href="/orgs">Organizations</NavLink>
          {superAdmin ? <NavLink href="/sa">Super admin</NavLink> : null}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        {children}
      </main>
    </div>
  );
}
