"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { decideManualCheckIn } from "@/actions/check-in";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ManualCheckInDecisionButtonProps = {
  checkInId: string;
  status: string;
  isManual: boolean;
  size?: "sm" | "default";
};

export function ManualCheckInDecisionButton({
  checkInId,
  status,
  isManual,
  size = "sm",
}: ManualCheckInDecisionButtonProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!isManual) return null;

  function handleApprove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      try {
        const res = await decideManualCheckIn(checkInId, "approved");
        if (res.ok) {
          toast.success("Manual entry approved.");
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  function handleRejectConfirm() {
    startTransition(async () => {
      try {
        const res = await decideManualCheckIn(
          checkInId,
          "rejected",
          reason.trim() || undefined,
        );
        if (res.ok) {
          toast.success("Manual entry rejected.");
          setRejectDialogOpen(false);
          setReason("");
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <>
      {status === "rejected" ? (
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={pending}
          onClick={handleApprove}
          className="gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 h-7 px-2"
        >
          <RotateCcw className="size-3" />
          Restore
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size={size}
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRejectDialogOpen(true);
          }}
          className="gap-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2"
        >
          <XCircle className="size-3" />
          Reject
        </Button>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              Reject Manual Check-In
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this manual entry? Rejected entries
              will be tagged as rejected in the records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label
              htmlFor="rejection-reason"
              className="text-xs font-medium text-foreground"
            >
              Reason for rejection (optional)
            </label>
            <Input
              id="rejection-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Unverified offsite visit or false entry"
              className="text-xs h-9"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setRejectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleRejectConfirm}
            >
              {pending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

