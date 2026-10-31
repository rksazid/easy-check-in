"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createTag,
  deleteTag,
  updateTag,
  type ActionResult,
} from "@/actions/tags";
import { TagBadge, TAG_COLORS, type TagColorId } from "@/components/tag-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TagUsage = {
  tagId: string;
  name: string;
  color?: string | null;
  people: number;
};

export function TagManager({
  organizationId,
  tags,
}: {
  organizationId: string;
  tags: TagUsage[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedColor, setSelectedColor] = useState<TagColorId>("blue");

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createTag.bind(null, organizationId),
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Tag added");
    formRef.current?.reset();
    setSelectedColor("blue");
  }, [state]);

  return (
    <div className="space-y-3">
      <form ref={formRef} action={action} className="space-y-2.5 max-w-md">
        <div className="flex gap-2">
          <Input
            name="name"
            placeholder="Project or team name"
            aria-label="New tag name"
            maxLength={40}
            required
            disabled={pending}
            className="flex-1"
          />
          <input type="hidden" name="color" value={selectedColor} />
          <Button type="submit" variant="outline" disabled={pending}>
            Add
          </Button>
        </div>

        {/* Color Swatches */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-muted-foreground text-xs mr-1">Color:</span>
          {TAG_COLORS.map((c) => {
            const isSelected = selectedColor === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedColor(c.id)}
                disabled={pending}
                title={c.label}
                aria-label={`Select ${c.label} color`}
                className={cn(
                  "size-5 rounded-full transition-transform",
                  c.dot,
                  isSelected
                    ? "ring-2 ring-offset-2 ring-primary scale-110"
                    : "opacity-70 hover:opacity-100 hover:scale-105"
                )}
              />
            );
          })}
        </div>
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
  const [color, setColor] = useState<string>(tag.color || "slate");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateTag(organizationId, tag.tagId, name, color);
      if (result.ok) {
        toast.success("Tag updated");
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {editing ? (
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label={`Rename ${tag.name}`}
            maxLength={40}
            className="max-w-48"
            disabled={pending}
          />

          <div className="flex items-center gap-1.5">
            {TAG_COLORS.map((c) => {
              const isSelected = color === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  disabled={pending}
                  title={c.label}
                  aria-label={`Color ${c.label}`}
                  className={cn(
                    "size-4 rounded-full transition-transform",
                    c.dot,
                    isSelected
                      ? "ring-2 ring-offset-2 ring-primary scale-110"
                      : "opacity-60 hover:opacity-100"
                  )}
                />
              );
            })}
          </div>

          <span className="flex gap-2 ml-auto sm:ml-0">
            <Button size="sm" disabled={pending} onClick={save}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setName(tag.name);
                setColor(tag.color || "slate");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </span>
        </div>
      ) : (
        <>
          <span className="flex items-center gap-2">
            <TagBadge name={tag.name} color={tag.color} />
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
              Edit
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
