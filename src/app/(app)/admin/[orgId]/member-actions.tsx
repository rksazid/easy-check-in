"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  decideJoinRequest,
  removeMemberFromOrg,
} from "@/actions/organizations";
import { Button } from "@/components/ui/button";

export function JoinRequestActions({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await decideJoinRequest(requestId, approve);
      if (result.ok) {
        toast.success(approve ? "Request approved" : "Request rejected");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <span className="flex shrink-0 gap-2 self-center">
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
    </span>
  );
}

export function MemberActions({
  organizationId,
  memberIdOrEmail,
  name,
}: {
  organizationId: string;
  memberIdOrEmail: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Remove ${name} from this organization?`)) return;
        startTransition(async () => {
          const result = await removeMemberFromOrg(
            organizationId,
            memberIdOrEmail,
          );
          if (result.ok) {
            toast.success(`${name} removed`);
          } else {
            toast.error(result.error);
          }
        });
      }}
    >
      Remove
    </Button>
  );
}
