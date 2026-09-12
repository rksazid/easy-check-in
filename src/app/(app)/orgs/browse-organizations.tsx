"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { requestToJoin } from "@/actions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type JoinableOrganization = { id: string; name: string; slug: string };

export function BrowseOrganizations({
  organizations,
}: {
  organizations: JoinableOrganization[];
}) {
  const [filter, setFilter] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  const visible = organizations.filter((org) =>
    org.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  if (organizations.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Join another organization</h2>
        <p className="text-muted-foreground border-border/70 rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          There&rsquo;s nothing else to join right now.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Join another organization</h2>

      {organizations.length > 5 ? (
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search organizations"
          aria-label="Search organizations"
        />
      ) : null}

      <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
        {visible.map((org) => (
          <li key={org.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{org.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenFor(openFor === org.id ? null : org.id)}
              >
                {openFor === org.id ? "Cancel" : "Ask to join"}
              </Button>
            </div>
            {openFor === org.id ? (
              <JoinRequestForm
                organizationId={org.id}
                onDone={() => setOpenFor(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No organization matches &ldquo;{filter}&rdquo;.
        </p>
      ) : null}
    </section>
  );
}

function JoinRequestForm({
  organizationId,
  onDone,
}: {
  organizationId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="mt-3 space-y-2">
      <Input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={280}
        placeholder="Add a note for the admin (optional)"
        aria-label="Note for the admin"
        disabled={pending}
      />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await requestToJoin(organizationId, message);
            if (result.ok) {
              toast.success("Request sent");
              onDone();
            } else {
              toast.error(result.error);
            }
          })
        }
      >
        {pending ? "Sending…" : "Send request"}
      </Button>
    </div>
  );
}
