"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrgManualCheckIn } from "@/actions/organizations";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type ManualCheckInSwitchProps = {
  organizationId: string;
  enabled: boolean;
  showBadge?: boolean;
};

export function ManualCheckInSwitch({
  organizationId,
  enabled: initialEnabled,
  showBadge = true,
}: ManualCheckInSwitchProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function onToggle(checked: boolean) {
    const prev = enabled;
    setEnabled(checked);

    startTransition(async () => {
      const result = await setOrgManualCheckIn(organizationId, checked);
      if (result.ok) {
        toast.success(
          checked
            ? "Manual check-in enabled for this organization."
            : "Manual check-in disabled for this organization.",
        );
      } else {
        setEnabled(prev);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label="Toggle manual check-in"
      />
      {showBadge ? (
        <Badge
          variant={enabled ? "outline" : "secondary"}
          className={
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium"
              : "text-muted-foreground text-[10px]"
          }
        >
          {enabled ? "Allowed" : "Disabled"}
        </Badge>
      ) : null}
    </div>
  );
}

