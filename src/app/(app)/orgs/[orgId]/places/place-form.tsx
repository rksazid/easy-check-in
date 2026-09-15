"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { createPlace, updatePlace, type ActionResult } from "@/actions/places";
import {
  LocationPicker,
  type PickedLocation,
} from "@/components/map/location-picker-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MIN_RADIUS_M = 25;
// The column permits up to 2000 m, but the slider stops at 500 because a
// check-in radius larger than that stops meaning "at this place".
const MAX_SLIDER_RADIUS_M = 500;

export type PlaceFormValues = {
  id?: string;
  name: string;
  placeTypeId: number | null;
  latitude: number;
  longitude: number;
  radiusM: number;
  address: string | null;
};

export function PlaceForm({
  organizationId,
  placeTypes,
  initial,
  needsApproval = false,
}: {
  organizationId: string;
  placeTypes: { id: number; name: string }[];
  initial: PlaceFormValues;
  /** True when the person adding this place cannot approve it themselves. */
  needsApproval?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(initial.id);

  const [location, setLocation] = useState<PickedLocation>({
    latitude: initial.latitude,
    longitude: initial.longitude,
    address: initial.address,
  });
  const [radiusM, setRadiusM] = useState(initial.radiusM);
  const [placeTypeId, setPlaceTypeId] = useState(
    initial.placeTypeId ? String(initial.placeTypeId) : "",
  );

  const action = editing
    ? updatePlace.bind(null, organizationId, initial.id as string)
    : createPlace.bind(null, organizationId);

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state?.ok) return;
    toast.success(
      editing
        ? "Place saved"
        : needsApproval
          ? "Place added. An admin will review it"
          : "Place added",
    );
    router.push(`/orgs/${organizationId}/places`);
  }, [state, editing, needsApproval, organizationId, router]);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={initial.name}
            placeholder="Head Office"
            required
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="placeTypeId">Kind of place</Label>
          <Select
            value={placeTypeId}
            onValueChange={setPlaceTypeId}
            disabled={pending}
          >
            <SelectTrigger id="placeTypeId" className="w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {placeTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="placeTypeId" value={placeTypeId} />
        </div>
      </div>

      <LocationPicker
        value={location}
        radiusM={radiusM}
        onChange={setLocation}
      />

      <input type="hidden" name="latitude" value={location.latitude} />
      <input type="hidden" name="longitude" value={location.longitude} />
      <input type="hidden" name="address" value={location.address ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="radiusM">
          Check-in radius: <span className="readout">{radiusM} m</span>
        </Label>
        <input
          id="radiusM"
          name="radiusM"
          type="range"
          min={MIN_RADIUS_M}
          max={MAX_SLIDER_RADIUS_M}
          step={5}
          value={radiusM}
          onChange={(event) => setRadiusM(Number(event.target.value))}
          disabled={pending}
          className="accent-signal w-full max-w-md"
        />
        <p className="text-muted-foreground max-w-prose text-xs">
          Phone GPS is typically accurate to 10–50 m outdoors and much worse
          indoors, so anything under 50 m will turn people away at the door.
        </p>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !placeTypeId}>
          {pending
            ? "Saving…"
            : editing
              ? "Save changes"
              : needsApproval
                ? "Submit for approval"
                : "Add place"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => router.push(`/orgs/${organizationId}/places`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
