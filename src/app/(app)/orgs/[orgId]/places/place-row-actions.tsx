"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { reviewPlace, setPlaceActive, withdrawPlace } from "@/actions/places";
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

export function PendingPlaceActions({
  organizationId,
  placeId,
  name,
  canReview,
  canWithdraw,
}: {
  organizationId: string;
  placeId: string;
  name: string;
  canReview: boolean;
  canWithdraw: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await reviewPlace(organizationId, placeId, approve);
      if (result.ok) {
        toast.success(approve ? `${name} approved` : `${name} rejected`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <span className="flex shrink-0 gap-2">
      {canReview ? (
        <>
          <Button size="sm" disabled={pending} onClick={() => decide(true)}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => decide(false)}
          >
            Reject
          </Button>
        </>
      ) : null}

      {/* The proposer can take back a suggestion an admin has not acted on. */}
      {!canReview && canWithdraw ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await withdrawPlace(organizationId, placeId);
              if (result.ok) {
                toast.success(`${name} withdrawn`);
              } else {
                toast.error(result.error);
              }
            })
          }
        >
          Withdraw
        </Button>
      ) : null}
    </span>
  );
}
