"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  checkIn,
  checkOut,
  findNearbyPlaces,
  storeLocation,
  type ActiveCheckIn,
  type NearbyPlace,
  type Position,
} from "@/actions/check-in";
import { grantLocationConsent } from "@/actions/consent";
import { Elapsed } from "@/components/elapsed";
import { RingButton } from "@/components/ring-button";
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
}: {
  active: ActiveCheckIn | null;
  /** Read from a cookie on the server, so the first paint is already right. */
  consented: boolean;
}) {
  if (active) return <CheckedIn active={active} />;
  if (!consented) return <ConsentGate />;
  return <NotCheckedIn />;
}

/* -------------------------------------------------------------------------- */

function CheckedIn({ active }: { active: ActiveCheckIn }) {
  const [pending, startTransition] = useTransition();

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
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">Checked in at</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {active.placeName}
        </h1>
        <p className="text-muted-foreground text-sm">
          {active.organizationName}, {active.placeTypeName}
        </p>
      </div>

      <p className="text-4xl font-semibold">
        <Elapsed since={active.checkedInAt} />
      </p>

      <RingButton
        label="Check out"
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function NotCheckedIn() {
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
            sublabel={pending ? undefined : "Find places near me"}
            pending={pending}
            onClick={look}
          />
          {error ? (
            <p className="text-destructive max-w-xs text-sm">{error}</p>
          ) : null}
        </>
      ) : nearest ? (
        <>
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

          <RingButton
            label="Check in"
            sublabel={nearest.canCheckIn ? undefined : "Too far away"}
            disabled={!nearest.canCheckIn}
            pending={pending}
            onClick={() => enter(nearest)}
          />

          {!nearest.canCheckIn ? (
            <p className="text-muted-foreground max-w-xs text-sm">
              {nearest.reason === "inaccurate"
                ? "Your location is too vague to be sure you are here. Step outside and try again."
                : `Get within ${nearest.radiusM} m of ${nearest.name} to check in.`}
            </p>
          ) : null}

          {others.length > 0 ? (
            <ul className="divide-border/70 border-border/70 w-full max-w-sm divide-y rounded-lg border text-left">
              {others.map((place) => (
                <li
                  key={place.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {place.name}
                    </span>
                    <span className="text-muted-foreground readout text-xs">
                      {formatDistance(place.distanceM)}
                    </span>
                  </span>
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

          <Button variant="ghost" size="sm" disabled={pending} onClick={look}>
            Look again
          </Button>
        </>
      ) : (
        <>
          <RingButton label="Check in" disabled onClick={() => {}} />
          <p className="text-muted-foreground max-w-xs text-sm">
            Nothing to check in to within reach. You need to be near a place one
            of your organizations has registered.
          </p>
          <Button variant="ghost" size="sm" disabled={pending} onClick={look}>
            Look again
          </Button>
        </>
      )}
    </div>
  );
}

function ConsentGate() {
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

      <Button
        size="lg"
        disabled={pending}
        onClick={() => startTransition(async () => grantLocationConsent())}
      >
        {pending ? "One moment" : "Got it, continue"}
      </Button>

      <p className="text-muted-foreground text-xs">
        Your browser asks for permission separately, and you can withdraw it at
        any time in your browser settings.
      </p>
    </div>
  );
}
