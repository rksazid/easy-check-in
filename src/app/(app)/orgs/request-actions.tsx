"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  cancelJoinRequest,
  respondToInvitation,
} from "@/actions/organizations";
import { Button } from "@/components/ui/button";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      const result = await respondToInvitation(invitationId, accept);
      if (result.ok) {
        toast.success(accept ? "Invitation accepted" : "Invitation declined");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <span className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => respond(true)}>
        Accept
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => respond(false)}
      >
        Decline
      </Button>
    </span>
  );
}

export function RequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cancelJoinRequest(requestId);
          toast.success("Request withdrawn");
        })
      }
    >
      Withdraw
    </Button>
  );
}
