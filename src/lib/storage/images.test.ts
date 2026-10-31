import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  storageKeyFor,
} from "./images";

describe("Image Storage Utilities", () => {
  it("defines supported image types", () => {
    expect(ALLOWED_IMAGE_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("image/webp")).toBe(true);
    expect(ALLOWED_IMAGE_TYPES.has("application/pdf")).toBe(false);
  });

  it("enforces max photo size limit", () => {
    expect(MAX_PHOTO_BYTES).toBe(10 * 1024 * 1024);
  });

  it("extracts storage key from local uploads or blob URLs", () => {
    expect(storageKeyFor("/uploads/places/photo.jpg")).toBe("places/photo.jpg");
    expect(storageKeyFor("https://blob.vercel-storage.com/photo.jpg")).toBe(
      "https://blob.vercel-storage.com/photo.jpg",
    );
  });
});

