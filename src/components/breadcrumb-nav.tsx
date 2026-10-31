import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbNavProps = {
  items?: BreadcrumbItem[];
  backHref?: string;
  backLabel?: string;
};

export function BreadcrumbNav({
  items,
  backHref,
  backLabel = "Back",
}: BreadcrumbNavProps) {
  return (
    <div className="flex flex-col gap-2.5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Prominent, unmistakably clickable Back Button */}
        {backHref && (
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-2xs transition-all hover:border-border hover:bg-accent hover:text-foreground active:scale-95"
          >
            <ArrowLeft className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-foreground" />
            <span>{backLabel}</span>
          </Link>
        )}

        {/* Breadcrumb Path Trail */}
        {items && items.length > 0 && (
          <nav
            aria-label="Breadcrumb navigation"
            className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto scrollbar-none py-1"
          >
            {items.map((item, index) => {
              const isLast = index === items.length - 1;
              return (
                <span
                  key={`${item.label}-${index}`}
                  className="inline-flex items-center gap-1.5 shrink-0"
                >
                  {index > 0 && (
                    <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
                  )}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="hover:text-foreground hover:underline underline-offset-4 transition-colors max-w-[150px] truncate"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={`max-w-[200px] truncate ${
                        isLast
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
