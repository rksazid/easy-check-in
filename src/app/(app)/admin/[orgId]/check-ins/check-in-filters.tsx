"use client";

import { useRouter } from "next/navigation";

import { getTagColorStyles } from "@/components/tag-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthLabel } from "@/lib/reports/month-window";

const ANY = "any";

type Selected = {
  month: string;
  place: string | null;
  person: string | null;
  tag: string | null;
  ending: string | null;
};

const ENDINGS = [
  { value: "open", label: "Still here" },
  { value: "manual", label: "Checked out" },
  { value: "auto_forgot", label: "Closed automatically" },
  { value: "admin", label: "Closed by an admin" },
];

export function CheckInFilters({
  organizationId,
  months,
  places,
  people,
  tags,
  selected,
}: {
  organizationId: string;
  months: string[];
  places: { id: string; name: string }[];
  people: { id: string; name: string }[];
  tags: { id: string; name: string; color?: string | null }[];
  selected: Selected;
}) {
  const router = useRouter();

  function apply(change: Partial<Selected>) {
    const next = { ...selected, ...change };
    const params = new URLSearchParams({ month: next.month });
    if (next.place) params.set("place", next.place);
    if (next.person) params.set("person", next.person);
    if (next.tag) params.set("tag", next.tag);
    if (next.ending) params.set("ending", next.ending);
    // Any change resets paging, or page 4 of the old filter shows nothing.
    router.push(`/admin/${organizationId}/check-ins?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={selected.month} onValueChange={(month) => apply({ month })}>
        <SelectTrigger className="w-40" aria-label="Month">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {formatMonthLabel(month)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selected.person ?? ANY}
        onValueChange={(person) =>
          apply({ person: person === ANY ? null : person })
        }
      >
        <SelectTrigger className="w-40" aria-label="Person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ANY}>Everyone</SelectItem>
          {people.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selected.place ?? ANY}
        onValueChange={(place) => apply({ place: place === ANY ? null : place })}
      >
        <SelectTrigger className="w-40" aria-label="Place">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ANY}>All places</SelectItem>
          {places.map((place) => (
            <SelectItem key={place.id} value={place.id}>
              {place.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tags.length > 0 ? (
        <Select
          value={selected.tag ?? ANY}
          onValueChange={(tag) => apply({ tag: tag === ANY ? null : tag })}
        >
          <SelectTrigger className="w-36" aria-label="Tag">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ANY}>All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full shrink-0 ${getTagColorStyles(tag.color).dot}`}
                    aria-hidden="true"
                  />
                  <span>{tag.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={selected.ending ?? ANY}
        onValueChange={(ending) =>
          apply({ ending: ending === ANY ? null : ending })
        }
      >
        <SelectTrigger className="w-44" aria-label="How it ended">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any ending</SelectItem>
          {ENDINGS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
