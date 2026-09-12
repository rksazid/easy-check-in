"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { adminCheckOut } from "@/actions/check-in";
import { Button } from "@/components/ui/button";

export function AdminCheckOutButton({
  organizationId,
  checkInId,
  name,
}: {
  organizationId: string;
  checkInId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Check ${name} out now?`)) return;
        startTransition(async () => {
          const result = await adminCheckOut(organizationId, checkInId);
          if (result.ok) {
            toast.success(`${name} checked out`);
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      Check out
    </Button>
  );
}
