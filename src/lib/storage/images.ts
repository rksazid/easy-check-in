import "server-only";

import { randomUUID } from "node:crypto";
import { getStorage } from "./provider";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per image

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function storageKeyFor(imageUrl: string): string {
  return imageUrl.startsWith("/uploads/")
    ? imageUrl.slice("/uploads/".length)
    : imageUrl;
}

export async function saveUploadedImage(
  file: File,
  folder: "places" | "check-ins" | "avatars",
): Promise<{ url: string; key: string }> {
  if (file.size === 0) {
    throw new Error("File is empty.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      "Only JPEG, PNG, WebP, GIF, and HEIC images are supported.",
    );
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const ext = EXTENSION_BY_TYPE[file.type] || "jpg";
  const key = `${folder}/${randomUUID()}.${ext}`;

  const storage = await getStorage();
  const buffer = await file.arrayBuffer();
  const stored = await storage.put(key, buffer, file.type);

  return stored;
}

export async function deleteStoredImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;
  try {
    const storage = await getStorage();
    await storage.remove(storageKeyFor(imageUrl));
  } catch {
    // Ignore error if already deleted
  }
}

