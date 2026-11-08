import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageDriver } from "./types";

/** Stores files under one directory. Keys never escape it (see `resolve`). */
export function createLocalStorage(root: string): StorageDriver {
  const base = path.resolve(root);

  function resolve(key: string): string {
    if (
      !/^[A-Za-z0-9_\-/.]+$/.test(key) ||
      key.split("/").some((p) => p === "" || p === "." || p === "..")
    ) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  return {
    async put(key, data) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data, { flag: "wx" });
    },
    async get(key) {
      const file = resolve(key);
      try {
        const { size } = await stat(file);
        const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
        return { stream, size };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
  };
}
