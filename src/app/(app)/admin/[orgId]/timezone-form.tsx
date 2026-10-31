"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrgTimezone } from "@/actions/organizations";
import { Button } from "@/components/ui/button";
import { TimezoneSelect } from "@/components/timezone-select";

export function TimezoneForm({
  organizationId,
  timezone,
}: {
  organizationId: string;
  timezone: string;
}) {
  const [value, setValue] = useState(timezone);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-center">
      <TimezoneSelect
        value={value}
        onChange={setValue}
        disabled={pending}
        className="flex-1"
      />

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
