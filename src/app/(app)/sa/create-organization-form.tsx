"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { createOrganization, type ActionResult } from "@/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateOrganizationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  // A ref, not state: whether the slug was hand-edited never affects rendering.
  const slugEdited = useRef(false);

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createOrganization,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Organization created");
    formRef.current?.reset();
    slugEdited.current = false;
  }, [state]);

  return (
    <form ref={formRef} action={action} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Name</Label>
        <Input
          id="org-name"
          name="name"
          placeholder="Iron Gym"
          required
          disabled={pending}
          onChange={(event) => {
            if (slugEdited.current || !slugRef.current) return;
            slugRef.current.value = slugify(event.target.value);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-slug">Slug</Label>
        <Input
          id="org-slug"
          name="slug"
          ref={slugRef}
          className="readout"
          placeholder="iron-gym"
          required
          disabled={pending}
          onChange={() => {
            slugEdited.current = true;
          }}
        />
        <p className="text-muted-foreground text-xs">
          Lowercase letters, numbers and dashes. Used in links.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="org-timezone">Time zone</Label>
        <Input
          id="org-timezone"
          name="timezone"
          defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
          className="readout"
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">
          Decides where each reporting month begins and ends.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
