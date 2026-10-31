"use client";

import {
  ArrowDown,
  ArrowUp,
  Building2,
  Coffee,
  Dumbbell,
  HardHat,
  Home,
  MapPin,
  Package,
  Pencil,
  Plus,
  Stethoscope,
  Store,
  Trash2,
  Trees,
  Users,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPlaceType,
  deletePlaceType,
  reorderPlaceType,
  updatePlaceType,
  type PlaceTypeAdminItem,
} from "@/actions/place-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESET_ICONS = [
  { value: "building-2", label: "Office", icon: Building2 },
  { value: "dumbbell", label: "Gym", icon: Dumbbell },
  { value: "users", label: "Co-work", icon: Users },
  { value: "package", label: "Warehouse", icon: Package },
  { value: "store", label: "Store", icon: Store },
  { value: "stethoscope", label: "Clinic", icon: Stethoscope },
  { value: "hard-hat", label: "Site", icon: HardHat },
  { value: "coffee", label: "Cafe", icon: Coffee },
  { value: "home", label: "Home", icon: Home },
  { value: "trees", label: "Park / Nature", icon: Trees },
  { value: "map-pin", label: "Other Pin", icon: MapPin },
];

function getIconComponent(iconName: string | null) {
  const match = PRESET_ICONS.find((i) => i.value === iconName);
  return match ? match.icon : MapPin;
}

export function PlaceTypeManager({
  initialPlaceTypes,
}: {
  initialPlaceTypes: PlaceTypeAdminItem[];
}) {
  const [items, setItems] = useState<PlaceTypeAdminItem[]>(initialPlaceTypes);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("map-pin");
  const [editSortOrder, setEditSortOrder] = useState(100);

  const [pending, startTransition] = useTransition();

  // Keep state synchronized with server props
  if (initialPlaceTypes !== items && !pending) {
    setItems(initialPlaceTypes);
  }

  function handleReorder(id: number, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderPlaceType(id, direction);
      if (res.ok) {
        toast.success("Order updated");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete the "${name}" kind of place?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deletePlaceType(id);
      if (res.ok) {
        toast.success(`Deleted "${name}"`);
      } else {
        toast.error(res.error);
      }
    });
  }

  function startEditing(item: PlaceTypeAdminItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditIcon(item.icon || "map-pin");
    setEditSortOrder(item.sortOrder);
  }

  function saveEdit(id: number) {
    const formData = new FormData();
    formData.set("name", editName);
    formData.set("icon", editIcon);
    formData.set("sortOrder", String(editSortOrder));

    startTransition(async () => {
      const res = await updatePlaceType(id, null, formData);
      if (res.ok) {
        toast.success("Updated kind of place");
        setEditingId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            Kinds of Place ({items.length})
          </h2>
          <p className="text-muted-foreground text-xs">
            Categories available when adding or editing places. Adjust order using the arrows.
          </p>
        </div>
        {!isAdding ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Add kind
          </Button>
        ) : null}
      </div>

      {/* New Place Type Form */}
      {isAdding ? (
        <form
          action={(formData) => {
            startTransition(async () => {
              const res = await createPlaceType(null, formData);
              if (res.ok) {
                toast.success("Kind of place created");
                setIsAdding(false);
              } else {
                toast.error(res.error);
              }
            });
          }}
          className="bg-card border-border/80 space-y-4 rounded-lg border p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Add new kind of place</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="h-8 w-8 p-0"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="new-name" className="text-xs">
                Name
              </Label>
              <Input
                id="new-name"
                name="name"
                placeholder="e.g. Swimming Pool, Studio, Park"
                required
                disabled={pending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-sortOrder" className="text-xs">
                Sort order (optional)
              </Label>
              <Input
                id="new-sortOrder"
                name="sortOrder"
                type="number"
                placeholder="e.g. 10, 20..."
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Pick an icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map((p) => {
                const Icon = p.icon;
                return (
                  <label
                    key={p.value}
                    className="hover:bg-accent has-[:checked]:bg-accent has-[:checked]:ring-primary/50 flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs transition-colors has-[:checked]:ring-2"
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={p.value}
                      defaultChecked={p.value === "map-pin"}
                      className="sr-only"
                    />
                    <Icon className="size-3.5" />
                    <span>{p.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Save place type"}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Place Types List */}
      <div className="divide-border/70 border-border/70 divide-y rounded-lg border">
        {items.map((item, index) => {
          const IconComponent = getIconComponent(item.icon);
          const isEditing = editingId === item.id;
          const isFirst = index === 0;
          const isLast = index === items.length - 1;

          if (isEditing) {
            return (
              <div
                key={item.id}
                className="bg-accent/20 space-y-3 p-3 text-sm transition-colors"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={pending}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sort order</Label>
                    <Input
                      type="number"
                      value={editSortOrder}
                      onChange={(e) => setEditSortOrder(Number(e.target.value))}
                      disabled={pending}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Icon</Label>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_ICONS.map((p) => {
                      const Icon = p.icon;
                      const selected = editIcon === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setEditIcon(p.value)}
                          className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input hover:bg-accent"
                          }`}
                        >
                          <Icon className="size-3" />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingId(null)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => saveEdit(item.id)}
                    disabled={pending}
                  >
                    {pending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="hover:bg-accent/30 flex items-center justify-between gap-3 px-3 py-2.5 transition-colors"
            >
              {/* Order Controls & Details */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Reorder Up/Down Buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move ${item.name} up`}
                    disabled={isFirst || pending}
                    onClick={() => handleReorder(item.id, "up")}
                    className="hover:bg-accent rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.name} down`}
                    disabled={isLast || pending}
                    onClick={() => handleReorder(item.id, "down")}
                    className="hover:bg-accent rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>

                {/* Icon & Label */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                    <IconComponent className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-sm">{item.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono text-muted-foreground">
                        #{item.sortOrder}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {item.placeCount === 0
                        ? "Not used by any place"
                        : `${item.placeCount} ${item.placeCount === 1 ? "place" : "places"}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Row Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  onClick={() => startEditing(item)}
                  aria-label={`Edit ${item.name}`}
                  disabled={pending}
                >
                  <Pencil className="size-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(item.id, item.name)}
                  aria-label={`Delete ${item.name}`}
                  disabled={pending || item.placeCount > 0}
                  title={
                    item.placeCount > 0
                      ? "Cannot delete because places are using this type"
                      : "Delete"
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

