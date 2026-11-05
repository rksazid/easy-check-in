import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  optimizeImageBuffer,
  storageKeyFor,
} from "./images";

describe("Image Storage Utilities", () => {
  it("defines supported image types", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/webp")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("application/pdf")).toBe(false);
  });

  it("enforces max photo size limit of 500 KB", () => {
    expect(MAX_PHOTO_BYTES).toBe(500 * 1024);
  });

  it("extracts storage key from local uploads or blob URLs", () => {
    expect(storageKeyFor("/uploads/places/photo.jpg")).toBe("places/photo.jpg");
    expect(storageKeyFor("https://blob.vercel-storage.com/photo.jpg")).toBe(
      "https://blob.vercel-storage.com/photo.jpg",
    );
  });

  it("optimizes image buffers to under 500 KB webp", async () => {
    // Create a large 2000x2000 test image
    const largeBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await optimizeImageBuffer(largeBuffer, "check-ins");
    expect(result.mimeType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect(result.buffer.length).toBeLessThanOrEqual(MAX_PHOTO_BYTES);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
  });

  it("optimizes avatar buffers to 512x512 bounds", async () => {
    const avatarBuffer = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 200, g: 80, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const result = await optimizeImageBuffer(avatarBuffer, "avatars");
    expect(result.mimeType).toBe("image/webp");
    expect(result.buffer.length).toBeLessThanOrEqual(MAX_PHOTO_BYTES);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
  });
});
