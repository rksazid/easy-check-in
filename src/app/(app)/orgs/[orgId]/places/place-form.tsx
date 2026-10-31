"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
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
  imageUrl?: string | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initial.imageUrl ?? null,
  );
  const [removeImage, setRemoveImage] = useState(false);

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

      <div className="space-y-2">
        <Label htmlFor="place-image">
          Photo of the place{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {previewUrl && !removeImage ? (
            <div className="border-border/70 bg-muted/40 relative size-24 shrink-0 overflow-hidden rounded-lg border">
              <img
                src={previewUrl}
                alt="Place preview"
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setRemoveImage(true);
                  setPreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="bg-background/80 text-destructive hover:bg-background absolute right-1 top-1 rounded-md p-1 backdrop-blur"
                title="Remove photo"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="border-border/70 bg-muted/20 text-muted-foreground flex size-24 shrink-0 items-center justify-center rounded-lg border border-dashed">
              <ImageIcon className="stroke-[1.5] size-8" />
            </div>
          )}

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                <Camera className="size-3.5" />
                {previewUrl && !removeImage ? "Change photo" : "Upload photo"}
              </Button>
              {previewUrl && !removeImage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setRemoveImage(true);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-destructive hover:text-destructive text-xs"
                >
                  Remove
                </Button>
              ) : null}
            </div>

            <input
              ref={fileInputRef}
              id="place-image"
              name="image"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreviewUrl(URL.createObjectURL(file));
                  setRemoveImage(false);
                }
              }}
            />

            <input
              type="hidden"
              name="imageUrl"
              value={
                removeImage
                  ? ""
                  : previewUrl?.startsWith("http") ||
                      previewUrl?.startsWith("/uploads")
                    ? previewUrl
                    : ""
              }
            />
            {removeImage ? (
              <input type="hidden" name="removeImage" value="true" />
            ) : null}

            <p className="text-muted-foreground text-xs">
              Upload a front photo, entrance, or building view (JPEG, PNG, WebP up
              to 10 MB).
            </p>
          </div>
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
