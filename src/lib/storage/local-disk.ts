import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider } from "./provider";

// Serving from public/ keeps local uploads working with no extra route. Vercel's
// filesystem is read-only at runtime, which is why production uses Blob instead.
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function resolveWithin(key: string) {
  const target = path.join(UPLOAD_ROOT, key);
  const relative = path.relative(UPLOAD_ROOT, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to write outside the upload directory.");
  }
  return target;
}

export const localDiskStorage: StorageProvider = {
  // Content type is implied by the file extension when served from public/.
  async put(key, data) {
    const target = resolveWithin(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(data));
    return { url: `/uploads/${key}`, key };
  },

  async remove(key) {
    try {
      await unlink(resolveWithin(key));
    } catch {
      // Already gone is the desired end state.
    }
  },
};
