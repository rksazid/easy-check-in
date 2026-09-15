"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createTag,
  deleteTag,
  renameTag,
  type ActionResult,
} from "@/actions/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TagUsage = { tagId: string; name: string; people: number };

export function TagManager({
  organizationId,
  tags,
}: {
  organizationId: string;
  tags: TagUsage[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createTag.bind(null, organizationId),
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Tag added");
    formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-3">
      <form ref={formRef} action={action} className="flex max-w-sm gap-2">
        <Input
          name="name"
          placeholder="Project or team name"
          aria-label="New tag name"
          maxLength={40}
          required
          disabled={pending}
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Add
        </Button>
      </form>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      {tags.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No tags yet. Add one, then put it on people below.
        </p>
      ) : (
        <ul className="divide-border/70 border-border/70 divide-y rounded-lg border">
          {tags.map((tag) => (
            <TagRow
              key={tag.tagId}
              organizationId={organizationId}
              tag={tag}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TagRow({
  organizationId,
  tag,
}: {
  organizationId: string;
  tag: TagUsage;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await renameTag(organizationId, tag.tagId, name);
      if (result.ok) {
        toast.success("Tag renamed");
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`Rename ${tag.name}`}
            maxLength={40}
            className="max-w-48"
            disabled={pending}
          />
          <span className="flex gap-2">
            <Button size="sm" disabled={pending} onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setName(tag.name);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </span>
        </>
      ) : (
        <>
          <span className="flex items-center gap-2">
            <Badge variant="secondary">{tag.name}</Badge>
            <span className="text-muted-foreground text-xs">
              {tag.people === 1 ? "1 person" : `${tag.people} people`}
            </span>
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                const warning =
                  tag.people > 0
                    ? `Remove ${tag.name} from ${tag.people === 1 ? "1 person" : `${tag.people} people`} and delete it?`
                    : `Delete ${tag.name}?`;
                if (!confirm(warning)) return;
                startTransition(async () => {
                  const result = await deleteTag(organizationId, tag.tagId);
                  if (result.ok) {
                    toast.success("Tag deleted");
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            >
              Delete
            </Button>
          </span>
        </>
      )}
    </li>
  );
}
