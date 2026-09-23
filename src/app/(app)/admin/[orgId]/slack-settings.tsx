"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  clearSlackWebhook,
  sendSlackTestMessage,
  setSlackNotifyEvents,
  setSlackWebhook,
  type ActionResult,
} from "@/actions/slack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SlackSettings({
  organizationId,
  connected,
  notifyEvents,
}: {
  organizationId: string;
  /** Masked on the server. The full address never reaches the browser. */
  connected: string | null;
  notifyEvents: boolean;
}) {
  const [state, action, saving] = useActionState<ActionResult | null, FormData>(
    setSlackWebhook.bind(null, organizationId),
    null,
  );
  const [pending, startTransition] = useTransition();
  const [events, setEvents] = useState(notifyEvents);

  useEffect(() => {
    if (state?.ok) toast.success("Slack connected. Check the channel.");
  }, [state]);

  if (connected) {
    return (
      <div className="max-w-md space-y-3">
        <p className="text-sm">
          Posting to Slack.{" "}
          <span className="readout text-muted-foreground text-xs">
            {connected}
          </span>
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={events}
            disabled={pending}
            className="accent-signal mt-0.5"
            onChange={(changed) => {
              const next = changed.target.checked;
              setEvents(next);
              startTransition(async () => {
                const result = await setSlackNotifyEvents(organizationId, next);
                if (!result.ok) {
                  toast.error(result.error);
                  setEvents(!next);
                }
              });
            }}
          />
          <span>
            Post when somebody is waiting on an admin, such as a request to join
            or a place added for approval.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await sendSlackTestMessage(organizationId);
                if (result.ok) {
                  toast.success("Test message sent");
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            Send a test message
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!confirm("Stop posting to Slack?")) return;
              startTransition(async () => {
                const result = await clearSlackWebhook(organizationId);
                if (result.ok) toast.success("Slack disconnected");
              });
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-md space-y-3">
      <div className="space-y-2">
        <Label htmlFor="webhookUrl">Slack webhook address</Label>
        <Input
          id="webhookUrl"
          name="webhookUrl"
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          className="readout"
          required
          disabled={saving}
        />
        <p className="text-muted-foreground text-xs">
          In Slack: create an app, turn on Incoming Webhooks, add one to the
          channel you want, then paste the address here. We send a message
          straight away to prove it works.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="outline" disabled={saving}>
        {saving ? "Connecting" : "Connect Slack"}
      </Button>
    </form>
  );
}
