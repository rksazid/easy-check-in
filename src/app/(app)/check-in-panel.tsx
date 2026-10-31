"use client";

import { useOffline } from "next/offline";
import { useCallback, useState, useTransition } from "react";
import { Hand } from "lucide-react";
import { toast } from "sonner";

import {
  checkIn,
  checkOut,
  findNearbyPlaces,
  storeLocation,
  type ActiveCheckIn,
  type ManualCheckInPlace,
  type NearbyPlace,
  type Position,
} from "@/actions/check-in";
import { grantLocationConsent } from "@/actions/consent";
import { CheckInPhotoGallery } from "@/components/check-in-photo-gallery";
import { Elapsed } from "@/components/elapsed";
import { ManualCheckInModal } from "@/components/manual-check-in-modal";
import { PlaceIcon } from "@/components/place-icon";
import { RingButton } from "@/components/ring-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/geo/haversine";

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 10_000,
};

function currentPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot report your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy ?? null,
        }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission is off. Turn it on for this site, then try again."
              : "Could not read your location. Try again in the open air.",
          ),
        ),
      GEOLOCATION_OPTIONS,
    );
  });
}

export function CheckInPanel({
  active,
  consented,
  manualPlaces = [],
}: {
  active: ActiveCheckIn | null;
  /** Read from a cookie on the server, so the first paint is already right. */
  consented: boolean;
  manualPlaces?: ManualCheckInPlace[];
}) {
  if (active) return <CheckedIn active={active} />;
  if (!consented) return <ConsentGate manualPlaces={manualPlaces} />;
  return <NotCheckedIn manualPlaces={manualPlaces} />;
}

/* -------------------------------------------------------------------------- */

function CheckedIn({ active }: { active: ActiveCheckIn }) {
  const [pending, startTransition] = useTransition();
  const offline = useOffline();

  function finish() {
    startTransition(async () => {
      // Checking out must not hinge on a location fix. Someone who has already
      // left, or who declines the prompt, still needs to close their visit.
      let position: Position | null = null;
      try {
        position = await currentPosition();
      } catch {
        position = null;
      }

      const result = await checkOut(position);
      if (result.ok) {
        toast.success(`Checked out of ${active.placeName}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function proveStillHere() {
    startTransition(async () => {
      try {
        const result = await storeLocation(await currentPosition());
        if (result.ok) {
          toast.success("Location stored");
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-8 py-2 text-center">
      <div className="flex flex-col items-center gap-2">
        <PlaceIcon
          imageUrl={active.placeImageUrl}
          icon={active.placeTypeIcon}
          typeName={active.placeTypeName}
          name={active.placeName}
          size="xl"
        />
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Checked in at</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {active.placeName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {active.organizationName}, {active.placeTypeName}
          </p>
          {active.isManual ? (
            <div className="pt-1 flex items-center justify-center gap-1.5 flex-wrap">
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 text-xs font-medium"
              >
                <Hand className="size-3 text-amber-500" />
                Manual entry
              </Badge>
              {active.status === "rejected" ? (
                <Badge variant="destructive" className="text-xs">
                  Rejected by admin
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-4xl font-semibold">
        <Elapsed since={active.checkedInAt} />
      </p>

      <RingButton
        label="Check out"
        sublabel={pending && offline ? "Waiting for a connection" : undefined}
        tone="stop"
        pending={pending}
        onClick={finish}
      />

      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={proveStillHere}
        >
          Store my location
        </Button>
        <p className="text-muted-foreground mx-auto max-w-xs text-xs">
          Optional. Records that you were here now
          {active.captureCount > 1
            ? `. ${active.captureCount} readings so far.`
            : "."}
        </p>
      </div>

      <div className="border-border/60 w-full max-w-sm border-t pt-4">
        <CheckInPhotoGallery
          checkInId={active.id}
          initialImages={active.images}
          canUpload={true}
          canDelete={true}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NotCheckedIn({
  manualPlaces = [],
}: {
  manualPlaces?: ManualCheckInPlace[];
}) {
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const offline = useOffline();

  const look = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const position = await currentPosition();
        setPlaces(await findNearbyPlaces(position));
      } catch (caught) {
        setError((caught as Error).message);
        setPlaces(null);
      }
    });
  }, []);

  function enter(place: NearbyPlace) {
    startTransition(async () => {
      try {
        const position = await currentPosition();
        const result = await checkIn(place.id, position);
        if (result.ok) {
          toast.success(`Checked in at ${place.name}`);
        } else {
          toast.error(result.error);
          setPlaces(await findNearbyPlaces(position));
        }
      } catch (caught) {
        toast.error((caught as Error).message);
      }
    });
  }

  const nearest = places?.[0];
  const others = places?.slice(1) ?? [];

  return (
    <div className="flex flex-col items-center gap-8 py-2 text-center">
      {places === null ? (
        <>
          <RingButton
            label="Check in"
            sublabel={
              pending
                ? offline
                  ? "Waiting for a connection"
                  : undefined
                : "Find places near me"
            }
            pending={pending}
            onClick={look}
          />
          {error ? (
            <div className="space-y-3 max-w-xs">
              <p className="text-destructive text-sm">{error}</p>
              {manualPlaces.length > 0 ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-left space-y-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Location unavailable?
                  </p>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                    Your organization allows manual check-in without GPS.
                  </p>
                  <ManualCheckInModal
                    places={manualPlaces}
                    trigger={
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full gap-1.5 text-xs h-8"
                      >
                        <Hand className="size-3.5" />
                        Check in manually
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : manualPlaces.length > 0 ? (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <ManualCheckInModal
                places={manualPlaces}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-dashed text-muted-foreground hover:text-foreground"
                  >
                    <Hand className="size-3.5 text-amber-500" />
                    Select place manually
                  </Button>
                }
              />
              <span className="text-[11px] text-muted-foreground/75">
                No GPS or offline? Manual check-in available
              </span>
            </div>
          ) : null}
        </>
      ) : nearest ? (
        <>
          <div className="flex flex-col items-center gap-2">
            <PlaceIcon
              imageUrl={nearest.imageUrl}
              icon={nearest.typeIcon}
              typeName={nearest.typeName}
              name={nearest.name}
              size="xl"
            />
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">
                {nearest.name}
              </h1>
              <p className="text-muted-foreground text-sm">
                {nearest.organizationName},{" "}
                <span className="readout">
                  {formatDistance(nearest.distanceM)}
                </span>{" "}
                away
              </p>
            </div>
          </div>

          <RingButton
            label="Check in"
            sublabel={
              pending && offline
                ? "Waiting for a connection"
                : nearest.canCheckIn
                  ? undefined
                  : "Too far away"
            }
            disabled={!nearest.canCheckIn}
            pending={pending}
            onClick={() => enter(nearest)}
          />

          {!nearest.canCheckIn ? (
            <div className="space-y-3 max-w-xs">
              <p className="text-muted-foreground text-sm">
                {nearest.reason === "inaccurate"
                  ? "Your location is too vague to be sure you are here. Step outside and try again."
                  : `Get within ${nearest.radiusM} m of ${nearest.name} to check in.`}
              </p>
              {manualPlaces.length > 0 ? (
                <div className="pt-1">
                  <ManualCheckInModal
                    places={manualPlaces}
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <Hand className="size-3.5 text-amber-500" />
                        Check in manually instead
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {others.length > 0 ? (
            <ul className="divide-border/70 border-border/70 w-full max-w-sm divide-y rounded-lg border text-left">
              {others.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlaceIcon
                      imageUrl={place.imageUrl}
                      icon={place.typeIcon}
                      typeName={place.typeName}
                      name={place.name}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {place.name}
                      </span>
                      <span className="text-muted-foreground readout text-xs">
                        {formatDistance(place.distanceM)}
                      </span>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!place.canCheckIn || pending}
                    onClick={() => enter(place)}
                  >
                    Check in
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" disabled={pending} onClick={look}>
              Look again
            </Button>
            {manualPlaces.length > 0 ? (
              <ManualCheckInModal
                places={manualPlaces}
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                    <Hand className="size-3 text-amber-500" />
                    Manual
                  </Button>
                }
              />
            ) : null}
          </div>
        </>
      ) : (
        <>
          <RingButton label="Check in" disabled onClick={() => {}} />
          <p className="text-muted-foreground max-w-xs text-sm">
            Nothing to check in to within reach. You need to be near a place one
            of your organizations has registered.
          </p>
          <div className="flex flex-col items-center gap-2">
            {manualPlaces.length > 0 ? (
              <ManualCheckInModal
                places={manualPlaces}
                trigger={
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 text-xs"
                  >
                    <Hand className="size-3.5" />
                    Check in manually ({manualPlaces.length} available)
                  </Button>
                }
              />
            ) : null}
            <Button variant="ghost" size="sm" disabled={pending} onClick={look}>
              Look again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ConsentGate({
  manualPlaces = [],
}: {
  manualPlaces?: ManualCheckInPlace[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-md space-y-5 py-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        Checking in uses your location
      </h1>

      <div className="text-muted-foreground space-y-3 text-sm">
        <p>
          Your device is asked for its position{" "}
          <strong className="text-foreground">
            only when you press a button
          </strong>
          : checking in, checking out, or storing your location during a visit.
        </p>
        <p>
          Nothing is read in the background, and nothing is recorded between
          those moments. Each reading stores where you were, how accurate the
          reading was, and when.
        </p>
        <p>
          Admins of your organization see when you checked in and out and for how
          long, so they can put together attendance reports.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          disabled={pending}
          onClick={() => startTransition(async () => grantLocationConsent())}
        >
          {pending ? "One moment" : "Got it, continue"}
        </Button>

        {manualPlaces.length > 0 ? (
          <div className="border-t border-border/70 pt-4 w-full text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              GPS unavailable or prefer not to use location?
            </p>
            <ManualCheckInModal
              places={manualPlaces}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Hand className="size-3.5 text-amber-500" />
                  Check in manually without GPS
                </Button>
              }
            />
          </div>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs text-center">
        Your browser asks for permission separately, and you can withdraw it at
        any time in your browser settings.
      </p>
    </div>
  );
}
