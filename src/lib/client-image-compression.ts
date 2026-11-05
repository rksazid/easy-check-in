"use client";

export const MAX_ALLOWED_IMAGE_BYTES = 500 * 1024; // 500 KB limit
export const TARGET_MAX_IMAGE_BYTES = 480 * 1024; // 480 KB target for safety buffer

export type ImageCompressOptions = {
  /** Maximum byte size allowed (defaults to 500 KB). */
  maxBytes?: number;
  /** Maximum width in pixels. */
  maxWidth?: number;
  /** Maximum height in pixels. */
  maxHeight?: number;
  /** Initial compression quality (0.0 to 1.0). */
  initialQuality?: number;
  /** Minimum quality to step down to (default 0.35). */
  minQuality?: number;
};

/**
 * Loads an image File into an HTMLImageElement using object URL.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image for optimization."));
    };
    img.src = url;
  });
}

/**
 * Converts a canvas to a Blob with the specified mime type and quality.
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Client-side image optimizer that resizes and compresses an image to ensure
 * its file size is strictly under 500 KB (TARGET_MAX_IMAGE_BYTES) while maintaining
 * good visual clarity.
 */
export async function compressImageToUnder500KB(
  file: File,
  options: ImageCompressOptions = {},
): Promise<File> {
  // If not running in browser environment, return file untouched
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  // If not an image (e.g. bad MIME), return untouched
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const maxBytes = options.maxBytes ?? TARGET_MAX_IMAGE_BYTES;
  let maxWidth = options.maxWidth ?? 1600;
  let maxHeight = options.maxHeight ?? 1600;
  let quality = options.initialQuality ?? 0.82;
  const minQuality = options.minQuality ?? 0.35;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    // If browser cannot decode image (e.g. corrupted or unsupported format), return original
    return file;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return file;
  }

  // Calculate scaled dimensions maintaining aspect ratio
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  canvas.width = width;
  canvas.height = height;

  // Use crisp image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // Preferred format is image/webp, fallback to image/jpeg if webp not supported
  let mimeType = "image/webp";
  let blob = await canvasToBlob(canvas, mimeType, quality);

  // If browser doesn't support webp canvas export, fall back to jpeg
  if (!blob || blob.type !== "image/webp") {
    mimeType = "image/jpeg";
    blob = await canvasToBlob(canvas, mimeType, quality);
  }

  // Quality step-down ladder if output exceeds target bytes
  const qualitySteps = [0.72, 0.62, 0.52, 0.42, minQuality];
  let stepIndex = 0;

  while (blob && blob.size > maxBytes && stepIndex < qualitySteps.length) {
    quality = qualitySteps[stepIndex];
    blob = await canvasToBlob(canvas, mimeType, quality);
    stepIndex++;
  }

  // If still above maxBytes after lowest quality, scale down dimensions
  while (blob && blob.size > maxBytes && width > 400 && height > 400) {
    width = Math.round(width * 0.8);
    height = Math.round(height * 0.8);
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    blob = await canvasToBlob(canvas, mimeType, minQuality);
  }

  if (!blob) {
    return file;
  }

  // Build clean filename with new extension
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const newFileName = `${baseName}.${ext}`;

  return new File([blob], newFileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

/**
 * Optimizes an avatar image specifically for profile display (square crop/fit, max 512px, under 500 KB).
 */
export async function compressAvatarPhoto(file: File): Promise<File> {
  return compressImageToUnder500KB(file, {
    maxBytes: 450 * 1024, // 450 KB max
    maxWidth: 512,
    maxHeight: 512,
    initialQuality: 0.85,
    minQuality: 0.45,
  });
}

/**
 * Optimizes a check-in visit photo (max 1600px, under 500 KB).
 */
export async function compressCheckInPhoto(file: File): Promise<File> {
  return compressImageToUnder500KB(file, {
    maxBytes: TARGET_MAX_IMAGE_BYTES,
    maxWidth: 1600,
    maxHeight: 1600,
    initialQuality: 0.80,
    minQuality: 0.35,
  });
}

/**
 * Optimizes a place location photo (max 1600px, under 500 KB).
 */
export async function compressPlacePhoto(file: File): Promise<File> {
  return compressImageToUnder500KB(file, {
    maxBytes: TARGET_MAX_IMAGE_BYTES,
    maxWidth: 1600,
    maxHeight: 1600,
    initialQuality: 0.80,
    minQuality: 0.35,
  });
}
