"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrgLogo } from "@/actions/organizations";
import { ORG_ICON_PRESETS, OrgIcon } from "@/components/org-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function OrgIconForm({
  organizationId,
  currentLogo,
}: {
  organizationId: string;
  currentLogo?: string | null;
}) {
  const initialLogo = currentLogo || "dumbbell";
  const [selected, setSelected] = useState<string>(initialLogo);
  const [customUrl, setCustomUrl] = useState<string>(
    initialLogo.startsWith("http://") || initialLogo.startsWith("https://")
      ? initialLogo
      : ""
  );
  const [pending, startTransition] = useTransition();

  const isPreset = ORG_ICON_PRESETS.some((p) => p.value === selected);

  const handlePresetSelect = (value: string) => {
    setSelected(value);
    setCustomUrl("");
  };

  const handleCustomUrlChange = (url: string) => {
    setCustomUrl(url);
    if (url.trim()) {
      setSelected(url.trim());
    } else {
      setSelected("dumbbell");
    }
  };

  const isChanged = selected !== initialLogo;

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <OrgIcon logo={selected} size="lg" />
        <div>
          <p className="text-sm font-medium">Selected icon preview</p>
          <p className="text-muted-foreground text-xs">
            Shown across check-ins, lists, and headers
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Choose preset icon</Label>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {ORG_ICON_PRESETS.map((p) => {
            const Icon = p.icon;
            const isSelected = selected === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePresetSelect(p.value)}
                disabled={pending}
                title={p.label}
                aria-label={`Select ${p.label} icon`}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/40 font-medium"
                    : "border-input hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate text-[10px] w-full">
                  {p.label.split("/")[0].trim()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custom-icon-url" className="text-xs">
          Or custom image / logo URL
        </Label>
        <Input
          id="custom-icon-url"
          type="url"
          placeholder="https://example.com/logo.png"
          value={customUrl}
          disabled={pending}
          onChange={(e) => handleCustomUrlChange(e.target.value)}
          className="text-xs"
        />
      </div>

      <Button
        disabled={pending || !isChanged}
        onClick={() =>
          startTransition(async () => {
            const result = await setOrgLogo(organizationId, selected);
            if (result.ok) {
              toast.success("Organization icon updated");
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        {pending ? "Saving…" : "Save icon"}
      </Button>
    </div>
  );
}

