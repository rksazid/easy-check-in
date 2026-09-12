"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { updateProfile, type ActionResult } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  name,
  username,
  email,
}: {
  name: string;
  username: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProfile,
    null,
  );

  useEffect(() => {
    if (state?.ok) toast.success("Profile saved");
  }, [state]);

  return (
    <form action={action} className="max-w-md space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          autoComplete="name"
          required
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          defaultValue={username}
          autoCapitalize="none"
          minLength={3}
          maxLength={30}
          required
          disabled={pending}
        />
        <p className="text-muted-foreground text-xs">
          Must be unique across Easy Check-In.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} readOnly disabled />
        <p className="text-muted-foreground text-xs">
          Your email is fixed for now, because your Gravatar and sign-in both
          depend on it.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
