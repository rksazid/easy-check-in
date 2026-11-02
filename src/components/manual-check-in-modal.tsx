"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Hand, Search } from "lucide-react";
import { toast } from "sonner";

import { manualCheckIn, type ManualCheckInPlace } from "@/actions/check-in";
import { PlaceIcon } from "@/components/place-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  cacheOfflinePlaces,
  enqueueOfflineEvent,
  getCachedOfflinePlaces,
  setLocalActiveCheckIn,
} from "@/lib/offline-sync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ManualCheckInModalProps = {
  places: ManualCheckInPlace[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ManualCheckInModal({
  places,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ManualCheckInModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // If provided list is empty (e.g. offline launch), load from cached places
  const [effectivePlaces, setEffectivePlaces] = useState<ManualCheckInPlace[]>(places);

  useEffect(() => {
    if (places && places.length > 0) {
      cacheOfflinePlaces(places);
      setEffectivePlaces(places);
    } else {
      const cached = getCachedOfflinePlaces();
      if (cached.length > 0) {
        setEffectivePlaces(cached);
      }
    }
  }, [places]);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return effectivePlaces;
    return effectivePlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.organizationName.toLowerCase().includes(q) ||
        p.typeName.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)),
    );
  }, [effectivePlaces, search]);

  function handleCheckIn(place: ManualCheckInPlace) {
    setPendingPlaceId(place.id);
    startTransition(async () => {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      if (isOffline) {
        const eventId = crypto.randomUUID();
        const now = new Date();
        enqueueOfflineEvent({
          id: eventId,
          type: "check_in",
          placeId: place.id,
          placeName: place.name,
          organizationId: place.organizationId,
          organizationName: place.organizationName,
          placeTypeName: place.typeName,
          placeTypeIcon: place.typeIcon,
          isManual: true,
          timestamp: now.toISOString(),
        });

        setLocalActiveCheckIn({
          id: `offline-${eventId}`,
          checkedInAt: now.toISOString(),
          placeId: place.id,
          placeName: place.name,
          placeTypeName: place.typeName,
          placeTypeIcon: place.typeIcon,
          placeImageUrl: place.imageUrl ?? null,
          organizationName: place.organizationName,
          latitude: place.latitude,
          longitude: place.longitude,
          radiusM: 100,
          captureCount: 1,
          isManual: true,
          status: "approved",
          images: [],
        });

        toast.info(
          `Checked in at ${place.name} (saved offline; will sync when server is reachable)`
        );
        setIsOpen(false);
        setPendingPlaceId(null);
        return;
      }

      try {
        const res = await manualCheckIn(place.id);
        if (res.ok) {
          toast.success(`Checked in manually at ${place.name}`);
          setIsOpen(false);
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        // Network timeout / connection lost / Vercel sleeping
        const eventId = crypto.randomUUID();
        const now = new Date();
        enqueueOfflineEvent({
          id: eventId,
          type: "check_in",
          placeId: place.id,
          placeName: place.name,
          organizationId: place.organizationId,
          organizationName: place.organizationName,
          placeTypeName: place.typeName,
          placeTypeIcon: place.typeIcon,
          isManual: true,
          timestamp: now.toISOString(),
        });

        setLocalActiveCheckIn({
          id: `offline-${eventId}`,
          checkedInAt: now.toISOString(),
          placeId: place.id,
          placeName: place.name,
          placeTypeName: place.typeName,
          placeTypeIcon: place.typeIcon,
          placeImageUrl: place.imageUrl ?? null,
          organizationName: place.organizationName,
          latitude: place.latitude,
          longitude: place.longitude,
          radiusM: 100,
          captureCount: 1,
          isManual: true,
          status: "approved",
          images: [],
        });

        toast.info(
          `Connection slow or offline. Saved check-in locally; will sync automatically.`
        );
        setIsOpen(false);
      } finally {
        setPendingPlaceId(null);
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Hand className="size-3.5 text-amber-500" />
            Manual check-in
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Hand className="size-4" />
            </div>
            <DialogTitle>Manual Check-in</DialogTitle>
          </div>
          <DialogDescription>
            Select an approved place from your organization to check in directly
            without GPS proximity.
          </DialogDescription>
        </DialogHeader>

        {places.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              No manual check-in places available
            </p>
            <p className="text-xs">
              None of your organizations have enabled manual check-in at this
              time. An administrator can enable this in organization settings.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {places.length > 4 ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by place name or organization..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
            ) : null}

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredPlaces.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No places match your search.
                </p>
              ) : (
                filteredPlaces.map((place) => {
                  const checkingThis = isPending && pendingPlaceId === place.id;
                  return (
                    <div
                      key={place.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlaceIcon
                          imageUrl={place.imageUrl}
                          icon={place.typeIcon}
                          typeName={place.typeName}
                          name={place.name}
                          size="sm"
                        />
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold truncate">
                              {place.name}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5"
                            >
                              {place.typeName}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {place.organizationName}
                          </p>
                          {place.address ? (
                            <p className="text-[10px] text-muted-foreground/80 truncate">
                              {place.address}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleCheckIn(place)}
                        className="shrink-0 h-8 px-3 text-xs"
                      >
                        {checkingThis ? "Checking in..." : "Check in"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

