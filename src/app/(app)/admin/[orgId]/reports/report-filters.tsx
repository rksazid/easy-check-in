"use client";

import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthLabel } from "@/lib/reports/month-window";

const ANY = "any";

export function ReportFilters({
  organizationId,
  months,
  places,
  types,
  tags,
  selected,
}: {
  organizationId: string;
  months: string[];
  places: { id: string; name: string }[];
  types: { id: number; name: string }[];
  tags: { id: string; name: string }[];
  selected: {
    month: string;
    place: string | null;
    type: number | null;
    tag: string | null;
  };
}) {
  const router = useRouter();

  function apply(change: Partial<typeof selected>) {
    const next = { ...selected, ...change };
    const params = new URLSearchParams({ month: next.month });
    if (next.place) params.set("place", next.place);
    if (next.type) params.set("type", String(next.type));
    if (next.tag) params.set("tag", next.tag);
    router.push(`/admin/${organizationId}/reports?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={selected.month} onValueChange={(month) => apply({ month })}>
        <SelectTrigger className="w-44" aria-label="Month">
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
        value={selected.place ?? ANY}
        onValueChange={(place) => apply({ place: place === ANY ? null : place })}
      >
        <SelectTrigger className="w-44" aria-label="Place">
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

      <Select
        value={selected.type ? String(selected.type) : ANY}
        onValueChange={(type) =>
          apply({ type: type === ANY ? null : Number(type) })
        }
      >
        <SelectTrigger className="w-44" aria-label="Kind of place">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ANY}>All kinds</SelectItem>
          {types.map((type) => (
            <SelectItem key={type.id} value={String(type.id)}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tags.length > 0 ? (
        <Select
          value={selected.tag ?? ANY}
          onValueChange={(tag) => apply({ tag: tag === ANY ? null : tag })}
        >
          <SelectTrigger className="w-44" aria-label="Tag">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ANY}>All tags</SelectItem>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
