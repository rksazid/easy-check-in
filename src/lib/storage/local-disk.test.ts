import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let workDir: string;

// The module pins its upload root to process.cwd() at import time, so the
// working directory has to be redirected before it is loaded.
beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "eci-storage-"));
  vi.spyOn(process, "cwd").mockReturnValue(workDir);
});

afterAll(async () => {
  vi.restoreAllMocks();
  await rm(workDir, { recursive: true, force: true });
});

async function loadStorage() {
  const { localDiskStorage } = await import("./local-disk");
  return localDiskStorage;
}

describe("localDiskStorage", () => {
  it("writes a file and returns a public path", async () => {
    const storage = await loadStorage();
    const bytes = new TextEncoder().encode("avatar-bytes").buffer;

    const stored = await storage.put("avatars/abc.png", bytes, "image/png");

    expect(stored.url).toBe("/uploads/avatars/abc.png");
    const written = await readFile(
      path.join(workDir, "public", "uploads", "avatars", "abc.png"),
      "utf8",
    );
    expect(written).toBe("avatar-bytes");
  });

  it("removes a file, and treats an already-missing file as success", async () => {
    const storage = await loadStorage();
    const bytes = new TextEncoder().encode("x").buffer;
    await storage.put("avatars/gone.png", bytes, "image/png");

    await expect(storage.remove("avatars/gone.png")).resolves.toBeUndefined();
    await expect(storage.remove("avatars/gone.png")).resolves.toBeUndefined();
  });

  it("refuses to escape the upload directory", async () => {
    const storage = await loadStorage();
    const bytes = new TextEncoder().encode("pwned").buffer;

    await expect(
      storage.put("../../../etc/passwd", bytes, "image/png"),
    ).rejects.toThrow(/outside the upload directory/);
  });
});
