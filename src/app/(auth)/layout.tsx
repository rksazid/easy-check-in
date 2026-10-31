import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <Link href="/" className="inline-flex rounded-md outline-offset-4">
          <BrandLockup />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
