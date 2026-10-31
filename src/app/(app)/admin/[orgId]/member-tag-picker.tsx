"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setMemberTags } from "@/actions/tags";
import { TagBadge, getTagColorStyles } from "@/components/tag-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; color?: string | null };

export function MemberTagPicker({
  organizationId,
  memberId,
  name,
  allTags,
  assigned,
}: {
  organizationId: string;
  memberId: string;
  name: string;
  allTags: Tag[];
  assigned: Tag[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(() =>
    new Set(assigned.map((tag) => tag.id)),
  );
  const [pending, startTransition] = useTransition();

  if (allTags.length === 0) return null;

  function toggle(tagId: string) {
    const next = new Set(selected);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    setSelected(next);

    startTransition(async () => {
      const result = await setMemberTags(organizationId, memberId, [...next]);
      if (!result.ok) {
        toast.error(result.error);
        // Put the old set back, so the chips match what was actually saved.
        setSelected(new Set(assigned.map((tag) => tag.id)));
      }
    });
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {assigned.length > 0 ? (
          assigned.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
          ))
        ) : (
          <span className="text-muted-foreground text-xs">No tags</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Done" : "Edit tags"}
        </Button>
      </div>

      {open ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label={`Tags for ${name}`}
        >
          {allTags.map((tag) => {
            const on = selected.has(tag.id);
            const c = getTagColorStyles(tag.color);
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(tag.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? cn(c.border, c.bg, c.text, "font-medium ring-1", c.border)
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full shrink-0", c.dot)} aria-hidden="true" />
                <span>{tag.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
