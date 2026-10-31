import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-border/70">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b border-border/70 bg-muted/40", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0 divide-y divide-border/60", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-muted/30",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 px-3.5 text-left align-middle font-medium text-muted-foreground text-xs whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "px-3.5 py-3 align-middle text-xs",
        className,
      )}
      {...props}
    />
  );
}

