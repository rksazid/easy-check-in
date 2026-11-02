"use client";

import { useOffline } from "next/offline";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Hand, RefreshCw } from "lucide-react";
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
import { distanceMeters, formatDistance } from "@/lib/geo/haversine";
import {
  cacheOfflinePlaces,
  enqueueOfflineEvent,
  getCachedOfflinePlaces,
  getLocalActiveCheckIn,
  setLocalActiveCheckIn,
  subscribeSyncStatus,
  syncOfflineQueue,
} from "@/lib/offline-sync";

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

function SyncStatusBadge() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus((count, syncing) => {
      setPendingCount(count);
      setIsSyncing(syncing);
    });
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-muted/80 px-3 py-1 text-xs text-muted-foreground border border-border/60">
      <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse" />
      <span>
        {pendingCount} unsynced offline {pendingCount === 1 ? "action" : "actions"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-[11px] font-semibold text-primary hover:text-primary/80"
        disabled={isSyncing}
        onClick={async () => {
          const res = await syncOfflineQueue();
          if (res.ok && res.syncedCount > 0) {
            toast.success(`Synced ${res.syncedCount} event(s)`);
          } else if (!res.ok) {
            toast.error("Server still unreachable. Retrying automatically in background.");
          }
        }}
      >
        {isSyncing ? (
          <span className="flex items-center gap-1">
            <RefreshCw className="size-3 animate-spin" />
            Syncing...
          </span>
        ) : (
          "Sync now"
        )}
      </Button>
    </div>
  );
}

export function CheckInPanel({
  active: serverActive,
  consented,
  manualPlaces = [],
}: {
  active: ActiveCheckIn | null;
  /** Read from a cookie on the server, so the first paint is already right. */
  consented: boolean;
  manualPlaces?: ManualCheckInPlace[];
}) {
  const [localActive, setLocalActive] = useState<ActiveCheckIn | null>(null);

  // Cache manual places locally whenever received
  useEffect(() => {
    if (manualPlaces && manualPlaces.length > 0) {
      cacheOfflinePlaces(manualPlaces);
    }
  }, [manualPlaces]);

  // Reconcile server active with local optimistic active check-in
  useEffect(() => {
    if (serverActive) {
      setLocalActive(null);
      setLocalActiveCheckIn(null);
    } else {
      const stored = getLocalActiveCheckIn();
      if (stored) {
        setLocalActive({
          ...stored,
          checkedInAt: new Date(stored.checkedInAt),
          images: [],
        });
      } else {
        setLocalActive(null);
      }
    }
  }, [serverActive]);

  useEffect(() => {
    return subscribeSyncStatus(() => {
      if (!serverActive) {
        const stored = getLocalActiveCheckIn();
        if (stored) {
          setLocalActive({
            ...stored,
            checkedInAt: new Date(stored.checkedInAt),
            images: [],
          });
        } else {
          setLocalActive(null);
        }
      }
    });
  }, [serverActive]);

  const currentActive = serverActive ?? localActive;

  return (
    <div className="flex flex-col items-center gap-4">
      <SyncStatusBadge />
      {currentActive ? (
        <CheckedIn
          active={currentActive}
          onOptimisticCheckOut={() => setLocalActive(null)}
        />
      ) : !consented ? (
        <ConsentGate manualPlaces={manualPlaces} />
      ) : (
        <NotCheckedIn
          manualPlaces={manualPlaces}
          onOptimisticCheckIn={(newActive) => setLocalActive(newActive)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CheckedIn({
  active,
  onOptimisticCheckOut,
}: {
  active: ActiveCheckIn;
  onOptimisticCheckOut?: () => void;
}) {
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

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      if (isOffline) {
        enqueueOfflineEvent({
          id: crypto.randomUUID(),
          type: "check_out",
          latitude: position?.latitude,
          longitude: position?.longitude,
          accuracyM: position?.accuracyM,
          timestamp: new Date().toISOString(),
        });
        setLocalActiveCheckIn(null);
        onOptimisticCheckOut?.();
        toast.info(
          `Checked out of ${active.placeName} (saved offline; will sync automatically when online)`
        );
        return;
      }

      try {
        const result = await checkOut(position);
        if (result.ok) {
          setLocalActiveCheckIn(null);
          onOptimisticCheckOut?.();
          toast.success(`Checked out of ${active.placeName}`);
        } else {
          toast.error(result.error);
        }
      } catch {
        // Network timeout / Vercel sleeping / offline
        enqueueOfflineEvent({
          id: crypto.randomUUID(),
          type: "check_out",
          latitude: position?.latitude,
          longitude: position?.longitude,
          accuracyM: position?.accuracyM,
          timestamp: new Date().toISOString(),
        });
        setLocalActiveCheckIn(null);
        onOptimisticCheckOut?.();
        toast.info(
          `Checked out of ${active.placeName} (saved offline; will sync automatically)`
        );
      }
    });
  }

  function proveStillHere() {
    startTransition(async () => {
      try {
        const position = await currentPosition();
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

        if (isOffline) {
          enqueueOfflineEvent({
            id: crypto.randomUUID(),
            type: "store_location",
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyM: position.accuracyM,
            timestamp: new Date().toISOString(),
          });
          toast.info("Location recorded offline; will sync when back online");
          return;
        }

        try {
          const result = await storeLocation(position);
          if (result.ok) {
            toast.success("Location stored");
          } else {
            toast.error(result.error);
          }
        } catch {
          enqueueOfflineEvent({
            id: crypto.randomUUID(),
            type: "store_location",
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyM: position.accuracyM,
            timestamp: new Date().toISOString(),
          });
          toast.info("Location recorded offline; will sync when server wakes up");
        }
      } catch (error) {
        toast.error((error as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-8 py-2 text-center w-full">
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
        sublabel={pending && offline ? "Saving offline..." : undefined}
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
  onOptimisticCheckIn,
}: {
  manualPlaces?: ManualCheckInPlace[];
  onOptimisticCheckIn?: (active: ActiveCheckIn) => void;
}) {
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const offline = useOffline();

  // If manualPlaces prop is empty (offline launch), load from cache
  const effectiveManualPlaces =
    manualPlaces.length > 0 ? manualPlaces : getCachedOfflinePlaces();

  const look = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const position = await currentPosition();
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

        if (isOffline) {
          const cached = getCachedOfflinePlaces();
          if (cached.length === 0) {
            setError(
              "Operating offline and no cached places found. Use manual check-in or connect to load places."
            );
            setPlaces(null);
            return;
          }

          const localNearby: NearbyPlace[] = cached
            .map((p) => {
              const d = distanceMeters(position, {
                latitude: p.latitude,
                longitude: p.longitude,
              });
              const radius = 120;
              const canCheckIn = d <= radius;
              return {
                id: p.id,
                name: p.name,
                organizationName: p.organizationName,
                typeName: p.typeName,
                typeIcon: p.typeIcon,
                imageUrl: p.imageUrl,
                distanceM: d,
                radiusM: radius,
                inside: canCheckIn,
                canCheckIn,
                reason: canCheckIn ? ("ok" as const) : ("too_far" as const),
              };
            })
            .sort((a, b) => a.distanceM - b.distanceM);

          setPlaces(localNearby);
          return;
        }

        try {
          const results = await findNearbyPlaces(position);
          setPlaces(results);
        } catch {
          // Server asleep or network timeout: fall back to client GPS calculation with cached places
          const cached = getCachedOfflinePlaces();
          if (cached.length > 0) {
            const localNearby: NearbyPlace[] = cached
              .map((p) => {
                const d = distanceMeters(position, {
                  latitude: p.latitude,
                  longitude: p.longitude,
                });
                const radius = 120;
                const canCheckIn = d <= radius;
                return {
                  id: p.id,
                  name: p.name,
                  organizationName: p.organizationName,
                  typeName: p.typeName,
                  typeIcon: p.typeIcon,
                  imageUrl: p.imageUrl,
                  distanceM: d,
                  radiusM: radius,
                  inside: canCheckIn,
                  canCheckIn,
                  reason: canCheckIn ? ("ok" as const) : ("too_far" as const),
                };
              })
              .sort((a, b) => a.distanceM - b.distanceM);
            setPlaces(localNearby);
          } else {
            setError("Server waking up. Please select a place manually or try again.");
            setPlaces(null);
          }
        }
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
        const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

        if (isOffline) {
          const eventId = crypto.randomUUID();
          const now = new Date();
          enqueueOfflineEvent({
            id: eventId,
            type: "check_in",
            placeId: place.id,
            placeName: place.name,
            organizationName: place.organizationName,
            placeTypeName: place.typeName,
            placeTypeIcon: place.typeIcon,
            placeImageUrl: place.imageUrl,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyM: position.accuracyM,
            isManual: false,
            timestamp: now.toISOString(),
          });

          const newActive: ActiveCheckIn = {
            id: `offline-${eventId}`,
            checkedInAt: now,
            placeId: place.id,
            placeName: place.name,
            placeTypeName: place.typeName,
            placeTypeIcon: place.typeIcon,
            placeImageUrl: place.imageUrl ?? null,
            organizationName: place.organizationName,
            latitude: position.latitude,
            longitude: position.longitude,
            radiusM: place.radiusM,
            captureCount: 1,
            isManual: false,
            status: "approved",
            images: [],
          };

          setLocalActiveCheckIn({
            ...newActive,
            checkedInAt: now.toISOString(),
          });
          onOptimisticCheckIn?.(newActive);
          toast.info(
            `Checked in at ${place.name} (saved offline; will sync automatically when back online)`
          );
          return;
        }

        try {
          const result = await checkIn(place.id, position);
          if (result.ok) {
            toast.success(`Checked in at ${place.name}`);
          } else {
            toast.error(result.error);
            setPlaces(await findNearbyPlaces(position));
          }
        } catch {
          // Network interruption or server sleeping
          const eventId = crypto.randomUUID();
          const now = new Date();
          enqueueOfflineEvent({
            id: eventId,
            type: "check_in",
            placeId: place.id,
            placeName: place.name,
            organizationName: place.organizationName,
            placeTypeName: place.typeName,
            placeTypeIcon: place.typeIcon,
            placeImageUrl: place.imageUrl,
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyM: position.accuracyM,
            isManual: false,
            timestamp: now.toISOString(),
          });

          const newActive: ActiveCheckIn = {
            id: `offline-${eventId}`,
            checkedInAt: now,
            placeId: place.id,
            placeName: place.name,
            placeTypeName: place.typeName,
            placeTypeIcon: place.typeIcon,
            placeImageUrl: place.imageUrl ?? null,
            organizationName: place.organizationName,
            latitude: position.latitude,
            longitude: position.longitude,
            radiusM: place.radiusM,
            captureCount: 1,
            isManual: false,
            status: "approved",
            images: [],
          };

          setLocalActiveCheckIn({
            ...newActive,
            checkedInAt: now.toISOString(),
          });
          onOptimisticCheckIn?.(newActive);
          toast.info(
            `Server waking up. Saved check-in offline; will sync automatically.`
          );
        }
      } catch (caught) {
        toast.error((caught as Error).message);
      }
    });
  }

  const nearest = places?.[0];
  const others = places?.slice(1) ?? [];

  return (
    <div className="flex flex-col items-center gap-8 py-2 text-center w-full">
      {places === null ? (
        <>
          <RingButton
            label="Check in"
            sublabel={
              pending
                ? offline
                  ? "Evaluating GPS..."
                  : undefined
                : "Find places near me"
            }
            pending={pending}
            onClick={look}
          />
          {error ? (
            <div className="space-y-3 max-w-xs">
              <p className="text-destructive text-sm">{error}</p>
              {effectiveManualPlaces.length > 0 ? (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-left space-y-2">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Location unavailable?
                  </p>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                    Your organization allows manual check-in without GPS.
                  </p>
                  <ManualCheckInModal
                    places={effectiveManualPlaces}
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
          ) : effectiveManualPlaces.length > 0 ? (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <ManualCheckInModal
                places={effectiveManualPlaces}
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
                ? "Saving offline..."
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
              {effectiveManualPlaces.length > 0 ? (
                <div className="pt-1">
                  <ManualCheckInModal
                    places={effectiveManualPlaces}
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {place.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {place.organizationName}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="readout text-sm">
                      {formatDistance(place.distanceM)}
                    </p>
                    {place.canCheckIn ? (
                      <button
                        type="button"
                        className="text-primary text-xs font-semibold hover:underline"
                        onClick={() => enter(place)}
                      >
                        Check in
                      </button>
                    ) : (
                      <p className="text-muted-foreground text-[11px]">
                        within {place.radiusM} m
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" disabled={pending} onClick={look}>
              Look again
            </Button>
            {effectiveManualPlaces.length > 0 ? (
              <ManualCheckInModal
                places={effectiveManualPlaces}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground"
                  >
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
            {effectiveManualPlaces.length > 0 ? (
              <ManualCheckInModal
                places={effectiveManualPlaces}
                trigger={
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2 text-xs"
                  >
                    <Hand className="size-3.5" />
                    Check in manually ({effectiveManualPlaces.length} available)
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
  const effectiveManualPlaces =
    manualPlaces.length > 0 ? manualPlaces : getCachedOfflinePlaces();

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

        {effectiveManualPlaces.length > 0 ? (
          <div className="border-t border-border/70 pt-4 w-full text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              GPS unavailable or prefer not to use location?
            </p>
            <ManualCheckInModal
              places={effectiveManualPlaces}
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
