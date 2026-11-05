"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCheckInImage,
  uploadCheckInImages,
  type CheckInImageItem,
} from "@/actions/check-in";
import { Button } from "@/components/ui/button";
import { compressCheckInPhoto } from "@/lib/client-image-compression";
import { cn } from "@/lib/utils";

export function CheckInPhotoGallery({
  checkInId,
  initialImages = [],
  canUpload = true,
  canDelete = true,
}: {
  checkInId: string;
  initialImages?: CheckInImageItem[];
  canUpload?: boolean;
  canDelete?: boolean;
}) {
  const [images, setImages] = useState<CheckInImageItem[]>(initialImages);
  const [activeImage, setActiveImage] = useState<CheckInImageItem | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if initialImages changes
  if (initialImages !== images && images.length === 0 && initialImages.length > 0) {
    setImages(initialImages);
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        // Optimize each image in parallel to ensure every file stays under 500 KB
        const optimizedFiles = await Promise.all(
          files.map((file) => compressCheckInPhoto(file)),
        );

        for (const file of optimizedFiles) {
          formData.append("images", file);
        }

        const result = await uploadCheckInImages(checkInId, formData);
        if (result.ok) {
          toast.success(
            result.count === 1
              ? "Photo optimized & uploaded"
              : `${result.count} photos optimized & uploaded`,
          );
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error((err as Error).message || "Could not process photos.");
      }
    });
  };

  const handleDelete = (imageId: string) => {
    startTransition(async () => {
      const result = await deleteCheckInImage(imageId);
      if (result.ok) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        if (activeImage?.id === imageId) {
          setActiveImage(null);
        }
        toast.success("Photo removed");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="w-full space-y-3 text-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Photos {images.length > 0 ? `(${images.length})` : ""}
        </h3>
        {canUpload ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={handleFilesSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs"
            >
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Optimizing & uploading…
                </>
              ) : (
                <>
                  <Camera className="size-3.5" />
                  Add photos
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {images.length === 0 ? (
        <div className="border-border/70 rounded-lg border border-dashed px-4 py-6 text-center">
          <ImagePlus className="text-muted-foreground mx-auto size-8 stroke-1" />
          <p className="text-muted-foreground mt-2 text-xs">
            {canUpload
              ? "No photos added yet. Upload workouts, setups, or proof of visit (auto-optimized under 500 KB)."
              : "No photos attached to this visit."}
          </p>
          {canUpload ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs"
            >
              Upload now
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {images.map((img) => (
            <div
              key={img.id}
              className="group border-border/70 relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
            >
              <button
                type="button"
                onClick={() => setActiveImage(img)}
                className="size-full focus:outline-none"
              >
                <img
                  src={img.imageUrl}
                  alt={img.caption || "Check-in photo"}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  disabled={pending}
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-destructive focus:opacity-100"
                  title="Delete photo"
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {activeImage ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-lg bg-background p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              title="Close preview"
            >
              <X className="size-4" />
            </button>
            <img
              src={activeImage.imageUrl}
              alt={activeImage.caption || "Check-in photo"}
              className="max-h-[75vh] w-auto rounded object-contain"
            />
            {activeImage.caption ? (
              <p className="p-2 text-sm text-center text-muted-foreground">
                {activeImage.caption}
              </p>
            ) : null}
            {canDelete ? (
              <div className="flex justify-end p-2 border-t border-border/50">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleDelete(activeImage.id)}
                  className="gap-1.5 text-xs"
                >
                  <Trash2 className="size-3.5" />
                  Delete photo
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

