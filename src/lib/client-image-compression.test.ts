import { describe, expect, it } from "vitest";

import {
  compressAvatarPhoto,
  compressCheckInPhoto,
  compressImageToUnder500KB,
  MAX_ALLOWED_IMAGE_BYTES,
  TARGET_MAX_IMAGE_BYTES,
} from "./client-image-compression";

describe("client-image-compression", () => {
  it("enforces maximum image byte limits under 500 KB", () => {
    expect(MAX_ALLOWED_IMAGE_BYTES).toBe(500 * 1024);
    expect(TARGET_MAX_IMAGE_BYTES).toBeLessThanOrEqual(500 * 1024);
    expect(TARGET_MAX_IMAGE_BYTES).toBe(480 * 1024);
  });

  it("safely handles non-browser environment without throwing", async () => {
    const dummyFile = new File(["dummy data"], "test.jpg", {
      type: "image/jpeg",
    });

    const result = await compressImageToUnder500KB(dummyFile);
    expect(result).toBe(dummyFile);
  });

  it("passes non-image files untouched", async () => {
    const textFile = new File(["not an image"], "notes.txt", {
      type: "text/plain",
    });

    const result = await compressImageToUnder500KB(textFile);
    expect(result).toBe(textFile);
  });

  it("exports specialized helpers for avatars and check-in photos", async () => {
    const dummyFile = new File(["dummy"], "photo.png", { type: "image/png" });

    const avatarRes = await compressAvatarPhoto(dummyFile);
    const checkInRes = await compressCheckInPhoto(dummyFile);

    expect(avatarRes).toBeDefined();
    expect(checkInRes).toBeDefined();
  });
});
