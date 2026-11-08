/** Where attachment bytes live. Swap the driver (e.g. S3) without touching services. */
export interface StorageDriver {
  /** Writes a new object. Fails if the key already exists. */
  put(key: string, data: Uint8Array): Promise<void>;
  /** Streams an object, or null when it doesn't exist. */
  get(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>;
  /** Deletes an object; missing objects are ignored. */
  delete(key: string): Promise<void>;
}
