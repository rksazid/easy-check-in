"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteUser, searchUsersToInvite } from "@/actions/organizations";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Candidate = Awaited<ReturnType<typeof searchUsersToInvite>>[number];

const MIN_QUERY_LENGTH = 3;

export function InviteMember({ organizationId }: { organizationId: string }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  function search() {
    startTransition(async () => {
      setResults(await searchUsersToInvite(organizationId, term));
      setSearched(true);
    });
  }

  function invite(candidate: Candidate) {
    startTransition(async () => {
      const result = await inviteUser(organizationId, candidate.email);
      if (result.ok) {
        toast.success(`Invitation sent to ${candidate.name}`);
        setResults((current) =>
          current.filter((row) => row.id !== candidate.id),
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="max-w-md space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <Input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setSearched(false);
          }}
          placeholder="Search by email address"
          aria-label="Search registered accounts by email"
          type="search"
          disabled={pending}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={pending || term.trim().length < MIN_QUERY_LENGTH}
        >
          Search
        </Button>
      </form>

      <p className="text-muted-foreground text-xs">
        People must already have an Easy Check-In account to be invited.
      </p>

      {results.length > 0 ? (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {results.map((candidate) => (
            <li
              key={candidate.id}
              className="flex items-center gap-3 px-3 py-2"
            >
              <Avatar
                name={candidate.name}
                src={candidate.image}
                className="size-8 text-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{candidate.name}</p>
                <p className="text-muted-foreground readout truncate text-xs">
                  {candidate.email}
                </p>
              </div>
              <Button size="sm" disabled={pending} onClick={() => invite(candidate)}>
                Invite
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {searched && results.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No account matches that email, or they&rsquo;re already a member.
        </p>
      ) : null}
    </div>
  );
}
