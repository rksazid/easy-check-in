import "server-only";

export type StoredFile = {
  /** Publicly reachable URL for the stored object. */
  url: string;
  /** Provider-specific handle, used to delete the object later. */
  key: string;
};

export interface StorageProvider {
  put(
    key: string,
    data: ArrayBuffer,
    contentType: string,
  ): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

/**
 * Vercel Blob in any environment that has a token, local disk otherwise, so a
 * developer can upload an avatar without signing up for anything. Swapping in
 * S3 later means adding one file here and nothing else.
 */
export async function getStorage(): Promise<StorageProvider> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { vercelBlobStorage } = await import("./vercel-blob");
    return vercelBlobStorage;
  }

  const { localDiskStorage } = await import("./local-disk");
  return localDiskStorage;
}
