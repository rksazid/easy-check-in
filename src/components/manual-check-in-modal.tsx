"use client";

import { useMemo, useState, useTransition } from "react";
import { Hand, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { manualCheckIn, type ManualCheckInPlace } from "@/actions/check-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.organizationName.toLowerCase().includes(q) ||
        p.typeName.toLowerCase().includes(q) ||
        (p.address && p.address.toLowerCase().includes(q)),
    );
  }, [places, search]);

  function handleCheckIn(place: ManualCheckInPlace) {
    setPendingPlaceId(place.id);
    startTransition(async () => {
      try {
        const res = await manualCheckIn(place.id);
        if (res.ok) {
          toast.success(`Checked in manually at ${place.name}`);
          setIsOpen(false);
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message);
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
                        {place.imageUrl ? (
                          <img
                            src={place.imageUrl}
                            alt={place.name}
                            className="size-10 shrink-0 rounded-md border border-border/70 object-cover"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted">
                            <MapPin className="size-4 text-muted-foreground" />
                          </div>
                        )}
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

