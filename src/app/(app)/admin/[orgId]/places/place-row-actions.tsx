"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setPlaceActive } from "@/actions/places";
import { Button } from "@/components/ui/button";

export function PlaceRowActions({
  organizationId,
  placeId,
  name,
  isActive,
}: {
  organizationId: string;
  placeId: string;
  name: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setPlaceActive(
            organizationId,
            placeId,
            !isActive,
          );
          if (result.ok) {
            toast.success(isActive ? `${name} archived` : `${name} restored`);
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {isActive ? "Archive" : "Restore"}
    </Button>
  );
}
