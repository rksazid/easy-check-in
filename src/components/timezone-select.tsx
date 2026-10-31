"use client";

import { Check, ChevronsUpDown, Globe, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "cn";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type TimezoneItem = {
  value: string;
  label: string;
  offset: string;
  searchStr: string;
};

function formatOffset(timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(new Date());
    const part = parts.find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  } catch {
    return "";
  }
}

export function TimezoneSelect({
  id,
  name = "timezone",
  defaultValue,
  value: controlledValue,
  onChange,
  disabled = false,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;

  // Resolve client's browser timezone safely
  const browserZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const initialZone = defaultValue || browserZone;
  const [internalValue, setInternalValue] = useState(initialZone);
  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate list of all accepted IANA timezones once
  const allTimezones = useMemo<TimezoneItem[]>(() => {
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      return zones.map((zone) => {
        const offset = formatOffset(zone);
        const readable = zone.replace(/_/g, " ");
        return {
          value: zone,
          label: readable,
          offset,
          searchStr: `${zone} ${readable} ${offset}`.toLowerCase(),
        };
      });
    } catch {
      return [
        {
          value: "UTC",
          label: "UTC",
          offset: "GMT",
          searchStr: "utc gmt",
        },
      ];
    }
  }, []);

  // Filter timezones based on search query
  const filteredTimezones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTimezones;
    return allTimezones.filter((item) => item.searchStr.includes(q));
  }, [allTimezones, search]);

  // Selected item metadata
  const selectedItem = useMemo(() => {
    return (
      allTimezones.find((z) => z.value === selectedValue) ?? {
        value: selectedValue,
        label: selectedValue.replace(/_/g, " "),
        offset: formatOffset(selectedValue),
      }
    );
  }, [allTimezones, selectedValue]);

  function handleSelect(val: string) {
    if (controlledValue === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
    setOpen(false);
    setSearch("");
  }

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [open]);

  return (
    <div className={cn("relative w-full", className)}>
      <input type="hidden" id={inputId} name={name} value={selectedValue} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            aria-label="Select timezone"
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors outline-none",
              "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              open && "border-ring ring-3 ring-ring/50"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <Globe aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate font-medium">{selectedItem.label}</span>
              {selectedItem.offset ? (
                <span className="text-muted-foreground readout shrink-0 text-xs">
                  ({selectedItem.offset})
                </span>
              ) : null}
              {selectedItem.value === browserZone ? (
                <span className="bg-secondary text-secondary-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  Local
                </span>
              ) : null}
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0 opacity-60"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-(--radix-popover-trigger-width) min-w-[300px] max-w-md p-0"
        >
          {/* Search Header */}
          <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
            <Search
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search time zone (e.g. New York, Dhaka)..."
              className="h-8 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Timezone List */}
          <div className="max-h-64 overflow-y-auto p-1 text-sm">
            {!search && browserZone && (
              <div className="mb-1 border-b border-border/40 pb-1">
                <div className="text-muted-foreground px-2 py-1 text-[11px] font-semibold uppercase tracking-wider">
                  Your Local Time
                </div>
                <button
                  type="button"
                  onClick={() => handleSelect(browserZone)}
                  className={cn(
                    "hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                    selectedValue === browserZone && "bg-accent/60 font-medium"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{browserZone.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground readout text-xs">
                      ({formatOffset(browserZone)})
                    </span>
                  </span>
                  {selectedValue === browserZone ? (
                    <Check className="text-primary size-4 shrink-0" />
                  ) : null}
                </button>
              </div>
            )}

            {filteredTimezones.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No time zone found for &ldquo;{search}&rdquo;
              </div>
            ) : (
              filteredTimezones.map((item) => {
                const isSelected = item.value === selectedValue;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelect(item.value)}
                    className={cn(
                      "hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      isSelected && "bg-accent/60 font-medium"
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="truncate">{item.label}</span>
                      {item.offset ? (
                        <span className="text-muted-foreground readout text-xs">
                          ({item.offset})
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? (
                      <Check className="text-primary size-4 shrink-0" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

