"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createOrganization, type ActionResult } from "@/actions/organizations";
import { ORG_ICON_PRESETS } from "@/components/org-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneSelect } from "@/components/timezone-select";
import { cn } from "@/lib/utils";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateOrganizationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  // A ref, not state: whether the slug was hand-edited never affects rendering.
  const slugEdited = useRef(false);
  const [selectedIcon, setSelectedIcon] = useState<string>("dumbbell");
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createOrganization,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Organization created");
    formRef.current?.reset();
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setSelectedIcon("dumbbell");
    slugEdited.current = false;
  }, [state]);

  return (
    <form ref={formRef} action={action} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Name</Label>
        <Input
          id="org-name"
          name="name"
          placeholder="Iron Gym"
          required
          disabled={pending}
          onChange={(event) => {
            if (slugEdited.current || !slugRef.current) return;
            slugRef.current.value = slugify(event.target.value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">Slug</Label>
        <Input
          id="org-slug"
          name="slug"
          ref={slugRef}
          className="readout"
          placeholder="iron-gym"
          required
          disabled={pending}
          onChange={() => {
            slugEdited.current = true;
          }}
        />
        <p className="text-muted-foreground text-xs">
          Lowercase letters, numbers and dashes. Used in links.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {ORG_ICON_PRESETS.map((p) => {
            const IconComponent = p.icon;
            const isSelected = selectedIcon === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setSelectedIcon(p.value)}
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
                <IconComponent className="size-4 shrink-0" />
                <span className="truncate text-[10px] w-full">{p.label.split("/")[0].trim()}</span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="logo" value={selectedIcon} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-timezone">Time zone</Label>
        <TimezoneSelect
          id="org-timezone"
          name="timezone"
          value={timezone}
          onChange={setTimezone}
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">
          Decides where each reporting month begins and ends.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
