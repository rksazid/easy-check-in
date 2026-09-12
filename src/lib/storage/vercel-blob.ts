import "server-only";

import { del, put } from "@vercel/blob";

import type { StorageProvider } from "./provider";

export const vercelBlobStorage: StorageProvider = {
  async put(key, data, contentType) {
    const blob = await put(key, data, {
      access: "public",
      contentType,
      // Keys already carry a random suffix of our own; a second one would make
      // the stored key unpredictable and therefore undeletable.
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    // `del` accepts the full URL in every version, so that is the safer handle.
    return { url: blob.url, key: blob.url };
  },

  async remove(key) {
    await del(key);
  },
};
