"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, Pencil, RotateCcw } from "lucide-react";

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
    <div className="flex items-center gap-1.5 shrink-0">
      <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
        <Link href={`/orgs/${organizationId}/places/${placeId}`}>
          <Pencil className="size-3 text-muted-foreground" />
          Edit
        </Link>
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
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
        {isActive ? (
          <>
            <Archive className="size-3 text-muted-foreground" />
            Archive
          </>
        ) : (
          <>
            <RotateCcw className="size-3" />
            Restore
          </>
        )}
      </Button>
    </div>
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
