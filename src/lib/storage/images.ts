import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getStorage } from "./provider";

export const MAX_PHOTO_BYTES = 500 * 1024; // 500 KB per image

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export function storageKeyFor(imageUrl: string): string {
  return imageUrl.startsWith("/uploads/")
    ? imageUrl.slice("/uploads/".length)
    : imageUrl;
}

/**
 * Optimizes an image buffer using sharp:
 * - Automatically auto-orients based on EXIF
 * - Resizes to target bounds (avatars: 512x512 cover; check-ins/places: 1600x1600 fit inside)
 * - Converts to WebP format
 * - Iteratively steps down compression quality and scale until the buffer is strictly under 500 KB.
 */
export async function optimizeImageBuffer(
  inputBuffer: Buffer,
  folder: "places" | "check-ins" | "avatars",
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  try {
    const isAvatar = folder === "avatars";
    const maxWidth = isAvatar ? 512 : 1600;
    const maxHeight = isAvatar ? 512 : 1600;
    const fit = isAvatar ? ("cover" as const) : ("inside" as const);

    let width = maxWidth;
    let height = maxHeight;
    const quality = isAvatar ? 85 : 80;

    let optimized = await sharp(inputBuffer)
      .rotate()
      .resize(width, height, { fit, withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();

    // If output exceeds MAX_PHOTO_BYTES, iteratively lower quality and dimensions
    const fallbackQualities = isAvatar ? [70, 55, 40] : [68, 55, 42];
    for (const q of fallbackQualities) {
      if (optimized.length <= MAX_PHOTO_BYTES) break;
      optimized = await sharp(inputBuffer)
        .rotate()
        .resize(width, height, { fit, withoutEnlargement: true })
        .webp({ quality: q, effort: 4 })
        .toBuffer();
    }

    // If still above 500 KB, reduce dimensions and retry
    if (optimized.length > MAX_PHOTO_BYTES) {
      width = isAvatar ? 400 : 1200;
      height = isAvatar ? 400 : 1200;
      optimized = await sharp(inputBuffer)
        .rotate()
        .resize(width, height, { fit, withoutEnlargement: true })
        .webp({ quality: 45, effort: 4 })
        .toBuffer();
    }

    if (optimized.length > MAX_PHOTO_BYTES) {
      width = isAvatar ? 320 : 960;
      height = isAvatar ? 320 : 960;
      optimized = await sharp(inputBuffer)
        .rotate()
        .resize(width, height, { fit, withoutEnlargement: true })
        .webp({ quality: 35, effort: 4 })
        .toBuffer();
    }

    if (optimized.length > MAX_PHOTO_BYTES) {
      throw new Error("Image must be 500 KB or smaller.");
    }

    return {
      buffer: optimized,
      mimeType: "image/webp",
      extension: "webp",
    };
  } catch (error) {
    // If sharp fails to decode (e.g. animated GIF or raw vector), fallback to raw if under limit
    if (inputBuffer.length > MAX_PHOTO_BYTES) {
      throw new Error("Image must be 500 KB or smaller.");
    }
    return {
      buffer: inputBuffer,
      mimeType: "image/jpeg",
      extension: "jpg",
    };
  }
}

export async function saveUploadedImage(
  file: File,
  folder: "places" | "check-ins" | "avatars",
  customPrefix?: string,
): Promise<{ url: string; key: string }> {
  if (file.size === 0) {
    throw new Error("File is empty.");
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      "Only JPEG, PNG, WebP, GIF, and HEIC images are supported.",
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeImageBuffer(rawBuffer, folder);

  if (optimized.buffer.length > MAX_PHOTO_BYTES) {
    throw new Error("Image must be 500 KB or smaller.");
  }

  const fileId = customPrefix
    ? `${customPrefix}-${randomUUID()}`
    : randomUUID();
  const key = `${folder}/${fileId}.${optimized.extension}`;

  const arrayBuffer = optimized.buffer.buffer.slice(
    optimized.buffer.byteOffset,
    optimized.buffer.byteOffset + optimized.buffer.byteLength,
  ) as ArrayBuffer;

  const storage = await getStorage();
  const stored = await storage.put(key, arrayBuffer, optimized.mimeType);

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
