"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrgTimezone } from "@/actions/organizations";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TimezoneForm({
  organizationId,
  timezone,
}: {
  organizationId: string;
  timezone: string;
}) {
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const [value, setValue] = useState(timezone);
  const [pending, startTransition] = useTransition();

  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex max-w-md flex-wrap items-center gap-2">
      <Select value={value} onValueChange={setValue} disabled={pending}>
        <SelectTrigger className="flex-1" aria-label="Organization time zone">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {zones.map((zone) => (
            <SelectItem key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
              {zone === browserZone ? " (yours)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        disabled={pending || value === timezone}
        onClick={() =>
          startTransition(async () => {
            const result = await setOrgTimezone(organizationId, value);
            if (result.ok) {
              toast.success("Time zone saved");
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
